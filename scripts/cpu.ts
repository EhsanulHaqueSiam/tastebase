// CPU per Worker request, against the free plan's 10ms: times the code each dynamic route runs (search, pick, plan,
// the palette's list, the hosted MCP building its server and answering a tool call) in Node, which is the same V8.
// Workers run on slower cores than a laptop, so the budget here is half: p95 under 5ms. `pnpm cpu`.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { jobFramework, pick, plan } from "../src/engine.ts";
import { formatPlan } from "../src/format.ts";
import { createServer } from "../src/mcp.ts";
import { aesthetics, libraries } from "../src/registry/index.ts";
import { resources } from "../src/registry/resources.ts";
import { withStats } from "../src/trending.ts";

const BUDGET = 5;
const queries = ["toast", "bottom sheet", "date picker", "pricing table", "command menu", "charts dashboard", "glass card", "data grid"];
const briefs = ["iOS-feel habit tracker with a bottom sheet", "neo-brutalist landing page with marquee", "analytics dashboard with charts and a data table", "dev-tool landing page like Resend with a shader hero"];
const libs = () => withStats(libraries, {}); // every request merges the KV stats into the registry first

async function time(name: string, run: (i: number) => unknown | Promise<unknown>, n = 200) {
  for (let i = 0; i < 20; i++) await run(i); // warm, as a Worker isolate is after its first request
  const ms: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    await run(i);
    ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  const p50 = ms[Math.floor(n / 2)]!, p95 = ms[Math.floor(n * 0.95)]!;
  console.log(`${name.padEnd(26)} p50 ${p50.toFixed(2).padStart(6)}ms  p95 ${p95.toFixed(2).padStart(6)}ms${p95 > BUDGET ? "  <-- over the 5ms budget" : ""}`);
  return p95 <= BUDGET;
}

// A cold isolate's first MCP requests, served the way site/src/pages/mcp.ts serves them (a fresh server per HTTP
// request on the web-standard transport), after the warm-up the Worker runs at startup (server.ts and mcp.ts).
// The one request most likely to near the 10ms limit on a quiet free-plan Worker; timed before anything else warms up.
async function mcpRequest(body: object) {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await createServer(libs(), aesthetics, "0").connect(transport);
  const res = await transport.handleRequest(new Request("http://x/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) }));
  return res.text();
}
formatPlan(plan(libraries, aesthetics, "warm-up: landing page dashboard with charts"));
pick(libraries, "toast");
createServer(libraries, aesthetics, "0");
// Node builds Request/Response in JavaScript (undici) on first use, ~11ms that workerd's built-in ones never cost;
// load them first so the cold numbers below are the Worker's, not Node's.
await new Response(JSON.stringify(await new Request("http://x", { method: "POST", body: "{}" }).json())).text();
const cold: number[] = [];
for (const body of [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "cpu", version: "0" } } },
  { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "plan", arguments: { brief: briefs[0] } } },
  { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "pick", arguments: { need: queries[0] } } },
]) {
  const t = performance.now();
  await mcpRequest(body);
  cold.push(performance.now() - t);
}
console.log(`${"MCP, cold isolate".padEnd(26)} initialize ${cold[0]!.toFixed(2)}ms, first plan ${cold[1]!.toFixed(2)}ms, first pick ${cold[2]!.toFixed(2)}ms${Math.max(...cold) > 2 * BUDGET ? "  <-- over 10ms" : ""}`);

const results = [
  Math.max(...cold) <= 2 * BUDGET,
  await time("GET /api/search", (i) => { const q = queries[i % queries.length]!; return pick(libs(), q, { limit: 30, framework: jobFramework(q) }); }),
  await time("GET /api/pick", (i) => pick(libs(), queries[i % queries.length]!)),
  await time("GET /api/plan", (i) => plan(libs(), aesthetics, briefs[i % briefs.length]!)),
  await time("GET /api/libs", () => JSON.stringify({ libs: libs().map((l) => ({ id: l.id, name: l.name, tagline: l.tagline, kind: l.kind, search: l.useFor.join(" ") })), resources: resources.map((r) => ({ id: r.id, name: r.name, goodFor: r.goodFor, kind: r.kind })) })),
  await time("MCP plan (server + call)", async (i) => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    const server = createServer(libs(), aesthetics, "0");
    await server.connect(a);
    const client = new Client({ name: "cpu", version: "0" });
    await client.connect(b);
    await client.callTool({ name: "plan", arguments: { brief: briefs[i % briefs.length] } });
    await client.close();
  }, 100),
  await time("MCP pick (server + call)", async (i) => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer(libs(), aesthetics, "0").connect(a);
    const client = new Client({ name: "cpu", version: "0" });
    await client.connect(b);
    await client.callTool({ name: "pick", arguments: { need: queries[i % queries.length] } });
    await client.close();
  }, 100),
  await time("format plan text", (i) => formatPlan(plan(libs(), aesthetics, briefs[i % briefs.length]!))),
];
process.exit(results.every(Boolean) ? 0 : 1);
