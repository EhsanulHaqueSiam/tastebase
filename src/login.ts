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
import { loginCode } from "./login-code.ts";

const base = () => process.env.TASTEBASE_URL ?? SITE;
const dir = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "tastebase");
const keyFile = () => join(dir(), "key");
/** The key this machine signed in with: TASTEBASE_KEY, else the saved one. */
export const savedKey = async () => process.env.TASTEBASE_KEY || (await readFile(keyFile(), "utf8").catch(() => "")).trim() || undefined;

const api = (path: string, init: RequestInit = {}, key?: string) =>
  fetch(`${base()}${path}`, { ...init, headers: { "content-type": "application/json", ...(key && { authorization: `Bearer ${key}` }) } });

export async function login(args: string[]) {
  const at = args.indexOf("--token");
  const key = at >= 0 ? args[at + 1] : await browserLogin();
  if (!key) throw new Error("--token needs a key: tastebase login --token tb_sk_...");
  const who = await api("/api/login", {}, key);
  if (!who.ok) throw new Error(`That key does not work (${who.status}). Make one at ${base()}/account#key.`);
  const { name } = (await who.json()) as { name: string };
  await mkdir(dir(), { recursive: true, mode: 0o700 });
  await writeFile(keyFile(), key, { mode: 0o600 });
  console.log(`Signed in as ${name}. Restart your agent: the tastebase plugin and \`npx tastebase\` now send your taste.`);
}

async function browserLogin() {
  const secret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const code = await loginCode(secret);
  const url = `${base()}/connect?code=${code}&name=${encodeURIComponent(hostname().replace(/\.local$/, ""))}`;
  console.log(`Open ${url}\nand approve the code ${code}. Waiting up to 10 minutes...`);
  const [cmd, ...pre] = process.platform === "darwin" ? ["open"] : process.platform === "win32" ? ["cmd", "/c", "start", ""] : ["xdg-open"];
  spawn(cmd!, [...pre, url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  for (const end = Date.now() + 600_000; Date.now() < end; await new Promise((r) => setTimeout(r, 2000))) {
    const r = await api("/api/login", { method: "POST", body: JSON.stringify({ secret }) }).catch(() => undefined);
    if (!r || r.status >= 500) continue; // offline for a moment, or the Worker hiccuped: keep waiting
    const { key, error } = (await r.json()) as { key?: string; error?: string };
    if (error) throw new Error(error);
    if (key) return key;
  }
  throw new Error("Nobody approved the code in 10 minutes. Run tastebase login again.");
}

/** Signs this machine out: its key stops working everywhere and the saved copy goes. */
export async function logout() {
  const key = await savedKey();
  if (key) await api("/api/login", { method: "DELETE" }, key).catch(() => undefined);
  await rm(keyFile(), { force: true });
  console.log(key ? "Signed out." : "Not signed in.");
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
