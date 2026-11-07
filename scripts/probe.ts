// Smoke-tests a running tastebase: pages, JSON API, and every MCP tool over HTTP, with token estimates.
//   pnpm probe http://localhost:1338          local (`pnpm dev` prints the port)
//   pnpm probe https://tastebase.ehsanulsiam.workers.dev --quiet
// Exits non-zero on any failure, so CI uses it after deploys.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const [base = "http://localhost:1337", ...flags] = process.argv.slice(2);
const quiet = flags.includes("--quiet");
const tokens = (s: string) => Math.round(s.length / 4);
let failed = 0;
const check = (ok: boolean, label: string, detail = "") => {
  if (!ok) failed++;
  if (!ok || !quiet) console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  ${detail}` : ""}`);
};

for (const [path, type] of [["/", "text/html"], ["/browse/vaul", "text/html"], ["/api/pick?q=toast", "application/json"], ["/shots/vaul.webp", "image/webp"]] as const) {
  const r = await fetch(base + path).catch((e: Error) => e);
  check(!(r instanceof Error) && r.ok && (r.headers.get("content-type") ?? "").startsWith(type), `GET ${path}`, r instanceof Error ? r.message : String(r.status));
}

const client = new Client({ name: "tastebase-probe", version: "0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", base)));
  const { tools } = await client.listTools();
  check(["get", "pick", "plan", "trending"].every((n) => tools.some((t) => t.name === n)), "MCP tools", `${tools.map((t) => t.name).join(", ")} (~${tokens(JSON.stringify(tools))} tokens of schema)`);
  const calls: [string, Record<string, unknown>, RegExp][] = [
    ["plan", { brief: "iOS-feel habit tracker with a bottom sheet and animated stats" }, /interaction -> vaul/],
    ["pick", { need: "copy button that confirms" }, /^torph:/],
    ["get", { id: "sonner" }, /^Sonner \(sonner\)/],
    ["trending", {}, /\S/],
  ];
  for (const [name, args, expect] of calls) {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as { type: string; text: string }[])[0]?.text ?? "";
    check(expect.test(text), `MCP ${name}`, `~${tokens(text)} tokens`);
    if (!quiet) console.log(text.split("\n").slice(0, 4).map((l) => `     ${l.slice(0, 140)}`).join("\n"));
  }
} catch (e) {
  check(false, "MCP", (e as Error).message);
} finally {
  await client.close().catch(() => {});
}

console.log(failed ? `${failed} check(s) failed against ${base}` : `all checks passed against ${base}`);
process.exit(failed ? 1 : 0);
