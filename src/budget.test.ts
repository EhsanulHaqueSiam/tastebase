// Token budget for what agents read. tastebase exists to save agents tokens, so tool schemas and typical
// answers must stay small. Raising a budget is a deliberate decision: say why in the PR.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { formatLibrary } from "./format.ts";
import { createServer, INSTRUCTIONS } from "./mcp.ts";
import { aesthetics, libraries } from "./registry/index.ts";
import { agentResourceKinds } from "./registry/resources.ts";

const tokens = (s: string) => Math.ceil(s.length / 4); // ~4 chars per token for English and code
const worst = (sizes: (readonly [string, number])[]) => sizes.reduce((m, g) => (g[1] > m[1] ? g : m));

// Plans are measured at their largest: briefs that ask for many kinds, and those under every look, since a look's rules
// are most of a plan and some looks are much wordier than others.
const BRIEFS = [
  "dev-tool landing page like Resend with a shader hero, charts and a command menu",
  "glassmorphism dashboard",
  "claymorphism landing page for a kids app with progress, confetti and toasts",
  "glassmorphism weather app with charts, bottom sheet and toasts",
  "iOS-feel habit tracker with a bottom sheet, animated stats and a command menu",
  "AI chat app like Claude with tool calls, charts and a data table",
  "Expo habit tracker with animated stats and a bottom sheet",
];
const EVERY_LOOK = [
  "landing page with charts, toasts and a command menu",
  "dashboard with charts, data table, toasts and command palette",
  "AI chat app with charts, a data table, toasts and a bottom sheet",
  "landing page with animations, a typewriter headline, confetti, a bottom sheet and a 3d hero",
];

const BUDGET = {
  instructions: 300, // sent with every session that connects, whether or not it calls a tool
  schemas: 700, // every tool definition together, loaded when an agent first reaches for tastebase
  plan: 925, // raised from 800: a site type's build line (3D, motion-led, media-led) adds up to 115 tokens to a plan
  pick: 250,
  get: 650, // raised from 550 for the cost line and parts list (capped); saves a docs fetch per library
};

async function connect() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(libraries, aesthetics, "test").connect(a);
  const client = new Client({ name: "budget", version: "0" });
  await client.connect(b);
  const text = async (name: string, args: Record<string, unknown>) =>
    ((await client.callTool({ name, arguments: args })).content as { text: string }[])[0]!.text;
  return { client, text };
}

test("tool schemas and typical answers stay within the token budget", async () => {
  const { client, text } = await connect();
  // Every id an agent is told it can `get`: each library, look and resource category, plus the look list.
  const ids = [...libraries.map((l) => l.id), ...aesthetics.map((a) => a.id), ...agentResourceKinds, "looks"];
  const gets = await Promise.all(ids.map(async (id) => [id, tokens(await text("get", { id }))] as const));
  const [getId, most] = worst(gets);
  const plans = await Promise.all([
    ...BRIEFS.map(async (brief) => [brief, tokens(await text("plan", { brief }))] as const),
    ...EVERY_LOOK.flatMap((brief) => aesthetics.map(async (a) => [`${brief} (look ${a.id})`, tokens(await text("plan", { brief, look: a.id }))] as const)),
  ]);
  const [planBrief, planMost] = worst(plans);
  const used = {
    instructions: tokens(INSTRUCTIONS),
    schemas: tokens(JSON.stringify((await client.listTools()).tools)),
    plan: planMost,
    pick: tokens(await text("pick", { need: "copy button that confirms" })),
    get: most,
  };
  await client.close();
  for (const k of Object.keys(BUDGET) as (keyof typeof BUDGET)[])
    assert.ok(used[k] <= BUDGET[k], `${k}: ${used[k]} tokens > budget ${BUDGET[k]}${k === "get" ? ` (get ${getId})` : k === "plan" ? ` (${planBrief})` : ""}`);
});

test("an unknown look id is answered with the closest ids", async () => {
  const { client, text } = await connect();
  assert.match(await text("plan", { brief: "habit tracker", look: "frosted-ios" }), /^Unknown look .*\bglass\b/);
  assert.match(await text("pick", { need: "toast", look: "minimalist" }), /^Unknown look .*\bminimal\b/);
  await client.close();
});

// Every library, not a sample: a new entry with a long note or parts list must not push its `get` past the budget.
test("every library's get answer stays within the budget", () => {
  const over = libraries.map((l) => [l.id, tokens(formatLibrary(l))] as const).filter(([, n]) => n > BUDGET.get);
  assert.deepEqual(over.map(([id, n]) => `${id}: ${n}`), [], "over the get budget");
});
