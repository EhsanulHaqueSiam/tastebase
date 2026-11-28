// A headless Chrome driven over the DevTools protocol with Node built-ins only, for the benchmark and other scripts and
// for `npx tastebase` capture (src/capture-local.ts).
// evals/design/browser.ts does the same for screenshots; it stays separate because the design eval fingerprints it.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "./chromium.ts";

type Msg = { id?: number; method?: string; params?: Record<string, unknown>; sessionId?: string; result?: Record<string, unknown>; error?: { message: string } };
export type Send = (method: string, params?: object) => Promise<Record<string, any>>;
export type Tab = { send: Send; on: (method: string, fn: (params: Record<string, any>) => void) => void; close: () => Promise<void> };

/** Starts Chrome, hands `use` a function that opens fresh tabs, and always shuts Chrome down after. */
export async function withChrome<T>(use: (openTab: () => Promise<Tab>) => Promise<T>): Promise<T> {
  const profile = mkdtempSync(join(tmpdir(), "tastebase-chrome-"));
  // GPU on, as visitors have it: without it headless Chrome composites in software, and a live, animating preview
  // iframe alone turns 40ms clicks into seconds. TB_CHROME_FLAGS adds flags for other machines.
  const gpu = process.platform === "darwin" ? ["--enable-gpu", "--use-angle=metal"] : ["--enable-gpu"];
  const extra = process.env.TB_CHROME_FLAGS?.split(" ").filter(Boolean) ?? [];
  // TB_HEADED=1 opens real windows: frames are produced as on a visitor's screen, which headless does not match when
  // a page holds a busy cross-origin iframe (the live preview).
  const mode = process.env.TB_HEADED ? ["--window-size=1440,1000"] : ["--headless=new"];
  const proc = spawn(chromium, [...mode, ...gpu, ...extra, "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  try {
    const portFile = join(profile, "DevToolsActivePort");
    for (let i = 0; !existsSync(portFile) || readFileSync(portFile, "utf8").split("\n").length < 2; i++) {
      if (i > 150 || proc.exitCode !== null) throw new Error(`Chrome did not start: ${chromium}`);
      await new Promise((r) => setTimeout(r, 100));
    }
    const [port, path] = readFileSync(portFile, "utf8").split("\n");
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    await new Promise((ok, fail) => ((ws.onopen = ok), (ws.onerror = fail)));
    let id = 0;
    const waiting = new Map<number, { ok: (v: Record<string, any>) => void; fail: (e: Error) => void }>();
    const listeners = new Map<string, ((p: Record<string, any>) => void)[]>();
    ws.onmessage = (m) => {
      const msg: Msg = JSON.parse(String(m.data));
      if (msg.id) {
        const w = waiting.get(msg.id);
        waiting.delete(msg.id);
        if (w) msg.error ? w.fail(new Error(msg.error.message)) : w.ok(msg.result ?? {});
      } else if (msg.method) for (const fn of listeners.get(`${msg.sessionId}:${msg.method}`) ?? []) fn(msg.params ?? {});
    };
    const raw = (method: string, params: object = {}, sessionId?: string) =>
      new Promise<Record<string, any>>((ok, fail) => {
        waiting.set(++id, { ok, fail });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      });
    // Each tab gets its own browser context (an incognito-like profile), so one page's localStorage, cookies and
    // cache never leak into the next measurement (a saved Atlas view or theme would otherwise follow every run).
    const openTab = async (): Promise<Tab> => {
      const { browserContextId } = await raw("Target.createBrowserContext", { disposeOnDetach: true });
      const { targetId } = await raw("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
      return {
        send: (method, params = {}) => raw(method, params, sessionId),
        on: (method, fn) => listeners.set(`${sessionId}:${method}`, [...(listeners.get(`${sessionId}:${method}`) ?? []), fn]),
        close: async () => {
          await raw("Target.closeTarget", { targetId });
          await raw("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
        },
      };
    };
    const out = await use(openTab);
    ws.close();
    return out;
  } finally {
    const exited = new Promise((r) => proc.once("exit", r));
    proc.kill();
    await exited;
    // Chrome's helper processes can still be writing the profile for a moment after the main one exits.
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {}
  }
}
