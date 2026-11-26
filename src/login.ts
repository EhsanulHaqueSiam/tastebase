// Signing a machine in: `tastebase login` (browser, or --token), `logout`, and the stdio relay that carries the saved
// key to the hosted server. The key lives in ~/.config/tastebase/key, where the Claude Code plugin's headersHelper
// (.claude-plugin/key.sh) reads it too.
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostname, homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { SITE } from "./format.ts";
import { loginCode, loginId } from "./login-code.ts";

const base = () => process.env.TASTEBASE_URL ?? SITE;
const dir = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "tastebase");
// Another server (TASTEBASE_URL, for a preview or `pnpm dev`) gets its own file, so its key and the production one never mix.
const keyFile = () => join(dir(), process.env.TASTEBASE_URL ? `key-${new URL(base()).host.replace(/[^\w.-]/g, "_")}` : "key");
const fileKey = async () => (await readFile(keyFile(), "utf8").catch(() => "")).trim() || undefined;
/** The key this machine signed in with: TASTEBASE_KEY, else the saved one. */
export const savedKey = async () => process.env.TASTEBASE_KEY || (await fileKey());

const api = (path: string, init: RequestInit = {}, key?: string) =>
  fetch(`${base()}${path}`, { ...init, headers: { "content-type": "application/json", ...(key && { authorization: `Bearer ${key}` }) } });

/** `login --token <key>` (or `--token=<key>`) saves a key made on /account; plain `login` signs in through the browser.
 *  The key it replaces is signed out, so logging in again never piles up keys. */
export async function login(args: string[]) {
  const at = args.findIndex((a) => a === "--token" || a.startsWith("--token="));
  const token = at < 0 ? undefined : args[at]!.includes("=") ? args[at]!.slice(8) : (args[at + 1] ?? "");
  if (token === "") throw new Error("--token needs a key: tastebase login --token tb_sk_...");
  const key = token ?? (await browserLogin());
  const who = await api("/api/login", {}, key).catch(() => undefined);
  // A pasted key is checked before it replaces anything; a key the browser login just made is saved whatever happens next.
  if (token && !who?.ok) throw new Error(`That key does not work (${who?.status ?? "offline"}). Make one at ${base()}/account#key.`);
  const { name } = who?.ok ? ((await who.json().catch(() => ({}))) as { name?: string }) : {};
  const old = await fileKey();
  await mkdir(dir(), { recursive: true, mode: 0o700 });
  await writeFile(keyFile(), key, { mode: 0o600 });
  const off = old && old !== key ? await api("/api/login", { method: "DELETE" }, old).catch(() => undefined) : { ok: true };
  console.log(`Signed in${name ? ` as ${name}` : ""}. Restart your agent: the tastebase plugin and \`npx tastebase\` now send your taste.`);
  if (!off?.ok) console.log(`The key this replaced (…${old!.slice(-4)}) may still work: sign it out at ${base()}/account#key.`);
}

async function browserLogin() {
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const id = await loginId(secret);
  const code = loginCode(id);
  const url = `${base()}/connect?id=${id}&name=${encodeURIComponent(hostname().replace(/\.local$/, ""))}`;
  console.log(`Open ${url}\nand approve the code ${code}. Waiting up to 10 minutes...`);
  const [cmd, ...pre] = process.platform === "darwin" ? ["open"] : process.platform === "win32" ? ["cmd", "/c", "start", ""] : ["xdg-open"];
  spawn(cmd!, [...pre, url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  for (const end = Date.now() + 600_000; Date.now() < end; await new Promise((r) => setTimeout(r, 2000))) {
    const r = await api("/api/login", { method: "POST", body: JSON.stringify({ secret }) }).catch(() => undefined);
    if (!r || r.status >= 500) continue; // offline for a moment, or the Worker hiccuped: keep waiting
    const { key, error } = (await r.json().catch(() => ({ error: `tastebase answered ${r.status} without a body. Run tastebase login again.` }))) as { key?: string; error?: string };
    if (error) throw new Error(error);
    if (key) return key;
  }
  throw new Error("Nobody approved the code in 10 minutes. Run tastebase login again.");
}

/** Signs this machine out: its key stops working everywhere and the saved copy goes. Says so when the server could not
 *  be told, since the key then still works. */
export async function logout() {
  const key = await fileKey();
  if (!key) return console.log(process.env.TASTEBASE_KEY ? "No saved key here; unset TASTEBASE_KEY to stop sending that one." : "Not signed in.");
  const r = await api("/api/login", { method: "DELETE" }, key).catch(() => undefined);
  await rm(keyFile(), { force: true });
  console.log(r?.ok ? "Signed out." : `Removed the saved key, but tastebase did not confirm it is off (${r?.status ?? "offline"}). Sign it out at ${base()}/account#key.`);
}

/** Signed in, the stdio server relays each message to the hosted one with the key, so answers carry the user's taste
 *  and the registry is always current. The hosted server is stateless, so every message is one POST. */
export async function relay(key: string) {
  const t = new StdioServerTransport();
  t.onmessage = async (m: JSONRPCMessage) => {
    const id = "id" in m ? m.id : undefined;
    try {
      const r = await fetch(`${base()}/mcp`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(m) });
      if (r.status === 202) return; // a notification
      const out = (await r.json()) as JSONRPCMessage;
      // A 401 answers with id null; the client waits on its own id.
      await t.send(id !== undefined && "error" in out ? { ...out, id } : out);
    } catch (e) {
      if (id !== undefined) await t.send({ jsonrpc: "2.0", id, error: { code: -32603, message: `tastebase is unreachable (${(e as Error).message}). Check the network, or run tastebase logout to use the offline copy.` } });
    }
  };
  await t.start();
}
