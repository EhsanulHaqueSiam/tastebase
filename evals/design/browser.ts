// Real headless Chrome over the DevTools protocol, with Node built-ins only. Chrome's one-shot CLI (--screenshot with
// --virtual-time-budget) never runs requestAnimationFrame or IntersectionObserver, so charts drew no bars and
// scroll-in content stayed invisible. Here pages run in real time, as a visitor sees them.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Shot = { width: number; height: number; reduced: boolean; png: string };
// The fields of DevTools replies this file reads.
type Reply = { targetId?: string; sessionId?: string; data?: string; result?: { value?: unknown } };

/**
 * Opens `chrome` headless and gives `use` a `shoot` that loads `url` in a fresh tab at the size and motion setting
 * asked, waits until `ready` (a page expression) returns a string, screenshots the first screen to `png` and returns
 * that string, or undefined when it never did within `timeoutMs`.
 */
export async function browse<T>(chrome: string, use: (shoot: (url: string, shot: Shot, ready: string, timeoutMs?: number) => Promise<string | undefined>) => Promise<T>): Promise<T> {
  const profile = mkdtempSync(join(tmpdir(), "tb-chrome-"));
  const proc = spawn(chrome, ["--headless=new", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  try {
    // Chrome writes the port it picked, and the browser's socket path, once it listens.
    const portFile = join(profile, "DevToolsActivePort");
    for (let i = 0; !existsSync(portFile) || readFileSync(portFile, "utf8").split("\n").length < 2; i++) {
      if (i > 150 || proc.exitCode !== null) throw new Error(`Chrome did not start: ${chrome}`);
      await new Promise((r) => setTimeout(r, 100));
    }
    const [port, path] = readFileSync(portFile, "utf8").split("\n");
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    await new Promise((ok, fail) => ((ws.onopen = ok), (ws.onerror = fail)));
    let id = 0;
    const waiting = new Map<number, { ok: (v: Reply) => void; fail: (e: Error) => void }>();
    ws.onmessage = (m) => {
      const msg = JSON.parse(String(m.data));
      const w = msg.id && waiting.get(msg.id);
      if (!w) return;
      waiting.delete(msg.id);
      msg.error ? w.fail(new Error(msg.error.message)) : w.ok(msg.result);
    };
    const send = (method: string, params: object = {}, sessionId?: string): Promise<Reply> =>
      new Promise((ok, fail) => {
        waiting.set(++id, { ok, fail });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      });

    const shoot = async (url: string, shot: Shot, ready: string, timeoutMs = 20_000) => {
      const { targetId } = await send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      const page = (method: string, params: object = {}) => send(method, params, sessionId);
      try {
        await page("Emulation.setDeviceMetricsOverride", { width: shot.width, height: shot.height, deviceScaleFactor: 1, mobile: shot.width < 600 });
        await page("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: shot.reduced ? "reduce" : "no-preference" }] });
        await page("Page.navigate", { url });
        let found: string | undefined;
        for (const end = Date.now() + timeoutMs; !found && Date.now() < end; await new Promise((r) => setTimeout(r, 200))) {
          const r = await page("Runtime.evaluate", { expression: ready, returnByValue: true });
          if (typeof r.result?.value === "string") found = r.result.value;
        }
        const { data } = await page("Page.captureScreenshot", { format: "png" });
        writeFileSync(shot.png, Buffer.from(data!, "base64"));
        return found;
      } finally {
        await send("Target.closeTarget", { targetId });
      }
    };
    const result = await use(shoot);
    ws.close();
    return result;
  } finally {
    const exited = new Promise((r) => proc.once("exit", r));
    proc.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true });
  }
}
