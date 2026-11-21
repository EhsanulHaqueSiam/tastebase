// Load test: many visitors at once walking the site, its JSON API and the hosted MCP, plus several CLI processes at
// once over stdio. Reports p50/p95/p99 and errors per endpoint, and checks compression and cache headers.
//   pnpm load https://tastebase-pr-54.ehsanulsiam.workers.dev                 40 users for 60s (about 4,000 requests)
//   pnpm load http://localhost:1337 --users 10 --seconds 20 --cli 4
// Sized for the free plan: 100,000 Worker requests a day per account, so keep --users x --seconds modest and never
// point it at prod. Exits 1 when any endpoint errors more than 0.5% or its p95 is over --p95 ms (default 800).
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:1337").replace(/\/$/, "");
const flag = (name: string, d: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : d; };
const users = flag("users", 40), seconds = flag("seconds", 60), cliProcs = flag("cli", 6), p95Max = flag("p95", 800);
if (/tastebase\.ehsanulsiam\.workers\.dev$/.test(new URL(base).host) && !args.includes("--prod")) throw new Error("Refusing to load-test prod; pass --prod if you really mean it.");

const ids = ["vaul", "sonner", "gsap", "shadcn-ui", "recharts", "motion", "lucide", "tiptap", "mantine", "radix-ui"];
const queries = ["toast", "bottom sheet", "date picker", "pricing table", "command menu", "charts dashboard", "glass card", "data grid"];
const briefs = ["iOS-feel habit tracker with a bottom sheet", "neo-brutalist landing page with marquee", "analytics dashboard with charts and a data table"];
const any = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;

// `check` reads the body for failures HTTP status misses: MCP answers tool errors with 200 and `isError`.
type Step = { name: string; run: () => Promise<Response>; check?: (body: string) => string | undefined };
const mcpError = (body: string) => {
  try {
    const m = JSON.parse(body) as { error?: { message: string }; result?: { isError?: boolean; content?: { text?: string }[] } };
    return m.error ? m.error.message : m.result?.isError ? `tool error: ${m.result.content?.[0]?.text?.slice(0, 80)}` : undefined;
  } catch {
    return "not JSON-RPC";
  }
};
const mcp = (body: object) => fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(process.env.TASTEBASE_KEY ? { authorization: `Bearer ${process.env.TASTEBASE_KEY}` } : {}) }, body: JSON.stringify(body) });
const steps: Step[] = [
  { name: "GET /", run: () => fetch(`${base}/`) },
  { name: "GET /browse/<id>", run: () => fetch(`${base}/browse/${any(ids)}`) },
  { name: "GET /atlas", run: () => fetch(`${base}/atlas`) },
  { name: "GET /api/search", run: () => fetch(`${base}/api/search?q=${encodeURIComponent(any(queries))}`) },
  { name: "GET /api/pick", run: () => fetch(`${base}/api/pick?q=${encodeURIComponent(any(queries))}`) },
  { name: "GET /api/plan", run: () => fetch(`${base}/api/plan?brief=${encodeURIComponent(any(briefs))}`) },
  { name: "GET /api/libs", run: () => fetch(`${base}/api/libs`) },
  { name: "GET /api/stats", run: () => fetch(`${base}/api/stats`) },
  { name: "GET /api/views", run: () => fetch(`${base}/api/views`) },
  // Every page view sends this; the Worker only counts same-origin posts. Previews write to the dev dataset, not prod's.
  { name: "POST /api/hit", run: () => fetch(`${base}/api/hit`, { method: "POST", headers: { origin: base } }) },
  { name: "MCP initialize", check: mcpError, run: () => mcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "tastebase-load", version: "0" } } }) },
  { name: "MCP pick", check: mcpError, run: () => mcp({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "pick", arguments: { need: any(queries) } } }) },
  { name: "MCP plan", check: mcpError, run: () => mcp({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "plan", arguments: { brief: any(briefs) } } }) },
];

const times = new Map<string, number[]>(), errors = new Map<string, string[]>();
const record = (name: string, ms: number, err?: string) => {
  (times.get(name) ?? times.set(name, []).get(name)!).push(ms);
  if (err) (errors.get(name) ?? errors.set(name, []).get(name)!).push(err);
};
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] ?? 0;

// Headers first: every page and API answer should be compressed, and hashed bundles cached for good.
const headerIssues: string[] = [];
for (const path of ["/", "/browse/vaul", "/atlas", "/api/libs", "/api/search?q=toast"]) {
  const r = await fetch(base + path, { headers: { "accept-encoding": "br, gzip" } });
  const enc = r.headers.get("content-encoding");
  const len = (await r.arrayBuffer()).byteLength;
  if (!enc) headerIssues.push(`${path}: not compressed (${Math.round(len / 1024)} KB)`);
}
const html = await (await fetch(`${base}/`)).text();
const bundle = html.match(/\/_astro\/[^"']+\.(js|css)/)?.[0];
if (bundle) {
  const cc = (await fetch(base + bundle)).headers.get("cache-control") ?? "(none)";
  if (!/immutable|max-age=31536000/.test(cc)) headerIssues.push(`${bundle}: cache-control "${cc}" (hashed, should be immutable)`);
}

// Visitors: each walks random steps with a short think time until time is up.
const end = Date.now() + seconds * 1000;
const visitor = async () => {
  while (Date.now() < end) {
    const step = any(steps);
    const t0 = performance.now();
    try {
      const r = await step.run();
      const body = await r.text();
      record(step.name, performance.now() - t0, r.ok ? step.check?.(body) : `HTTP ${r.status}`);
    } catch (e) {
      record(step.name, performance.now() - t0, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 700));
  }
};

// CLI users: several `tastebase` stdio servers running for the whole test, as agents keep them: each starts, then
// keeps asking for plans, picks and entries with the same think time as the visitors, every answer timed.
const cliUser = async (i: number) => {
  const t0 = performance.now();
  const proc = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", "src/cli.ts"], { stdio: ["pipe", "pipe", "ignore"] });
  const pending = new Map<number, (msg: { result?: { content?: { text?: string }[] }; error?: { message: string } }) => void>();
  let buf = "", id = 0;
  proc.stdout.on("data", (d) => {
    buf += d;
    for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n")) {
      const msg = JSON.parse(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    }
  });
  const call = (method: string, params: object) =>
    Promise.race([
      new Promise<Parameters<NonNullable<ReturnType<typeof pending.get>>>[0]>((ok) => { pending.set(++id, ok); proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); }),
      new Promise<never>((_, fail) => setTimeout(() => fail(new Error("timeout")), 30_000)),
    ]);
  try {
    await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "load", version: "0" } });
    record("CLI start (stdio)", performance.now() - t0);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    for (let n = 0; Date.now() < end; n++) {
      const [name, tool, args] = ([["CLI plan (stdio)", "plan", { brief: any(briefs) }], ["CLI pick (stdio)", "pick", { need: any(queries) }], ["CLI get (stdio)", "get", { id: any(ids) }]] as const)[(n + i) % 3]!;
      const t = performance.now();
      try {
        const msg = await call("tools/call", { name: tool, arguments: args });
        record(name, performance.now() - t, msg.result?.content?.[0]?.text ? undefined : (msg.error?.message ?? "empty answer"));
      } catch (e) {
        record(name, performance.now() - t, (e as Error).message);
      }
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 700));
    }
  } catch (e) {
    record("CLI start (stdio)", performance.now() - t0, (e as Error).message);
  } finally {
    proc.kill();
  }
};

console.log(`${users} visitors for ${seconds}s against ${base}, and ${cliProcs} CLI processes at once`);
const t0 = Date.now();
await Promise.all([...Array.from({ length: users }, visitor), ...Array.from({ length: cliProcs }, (_, i) => cliUser(i))]);
const total = [...times.values()].reduce((s, xs) => s + xs.length, 0);

let bad = 0;
console.log(`\n${"endpoint".padEnd(22)} ${"n".padStart(5)} ${"p50".padStart(6)} ${"p95".padStart(6)} ${"p99".padStart(6)} ${"max".padStart(6)}  errors`);
for (const [name, xs] of times) {
  const errs = errors.get(name) ?? [];
  const p95 = pct(xs, 95);
  const fails = errs.length / xs.length > 0.005 || p95 > p95Max;
  if (fails) bad++;
  console.log(`${name.padEnd(22)} ${String(xs.length).padStart(5)} ${pct(xs, 50).toFixed(0).padStart(6)} ${p95.toFixed(0).padStart(6)} ${pct(xs, 99).toFixed(0).padStart(6)} ${Math.max(...xs).toFixed(0).padStart(6)}  ${errs.length ? `${errs.length} (${[...new Set(errs)].slice(0, 3).join("; ")})` : "0"}${fails ? "  <-- over budget" : ""}`);
}
console.log(`\n${total} requests in ${((Date.now() - t0) / 1000).toFixed(0)}s (${(total / ((Date.now() - t0) / 1000)).toFixed(1)}/s)`);
for (const h of headerIssues) console.log(`header: ${h}`);
process.exit(bad || headerIssues.length ? 1 : 0);
