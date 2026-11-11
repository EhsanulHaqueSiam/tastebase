// Token budget for what agents read. tastebase exists to save agents tokens, so tool schemas and typical
// answers must stay small. Raising a budget is a deliberate decision: say why in the PR.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { formatLibrary } from "./format.ts";
import { createServer } from "./mcp.ts";
import { aesthetics, libraries } from "./registry/index.ts";

const tokens = (s: string) => Math.ceil(s.length / 4); // ~4 chars per token for English and code

const BUDGET = {
  schemas: 700, // every tool definition together, loaded when an agent first reaches for tastebase
  plan: 800,
  pick: 250,
  get: 650, // raised from 550 for the cost line and parts list (capped at 40 names); saves a docs fetch per library
};

test("tool schemas and typical answers stay within the token budget", async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(libraries, aesthetics, "test").connect(a);
  const client = new Client({ name: "budget", version: "0" });
  await client.connect(b);
  const text = async (name: string, args: Record<string, unknown>) =>
    ((await client.callTool({ name, arguments: args })).content as { text: string }[])[0]!.text;

  const used = {
    schemas: tokens(JSON.stringify((await client.listTools()).tools)),
    plan: tokens(await text("plan", { brief: "dev-tool landing page like Resend with a shader hero, charts and a command menu" })),
    pick: tokens(await text("pick", { need: "copy button that confirms" })),
    get: Math.max(...(await Promise.all(["shadcn-ui", "aceternity-ui", "motion", "paper-shaders", "vaul", "references", "tools"].map(async (id) => tokens(await text("get", { id })))))),
  };
  await client.close();
  for (const k of Object.keys(BUDGET) as (keyof typeof BUDGET)[]) assert.ok(used[k] <= BUDGET[k], `${k}: ${used[k]} tokens > budget ${BUDGET[k]}`);
});

// Every library, not a sample: a new entry with a long note or parts list must not push its `get` past the budget.
// These are over it today, each with its own ceiling so it cannot grow further; trim one and take it off the list.
const OVER: Record<string, number> = { "transitions-dev": 851, "affect-ui": 746, "arc-ui": 715, "cult-ui": 705, bencho: 691, boardui: 681, "kokonut-ui": 668, astryx: 663, "ui-stacks": 722, "opensource-ui": 703 };

test("every library's get answer stays within the budget", () => {
  const used = Object.fromEntries(libraries.map((l) => [l.id, tokens(formatLibrary(l))]));
  assert.deepEqual(libraries.filter((l) => used[l.id]! > (OVER[l.id] ?? BUDGET.get)).map((l) => `${l.id}: ${used[l.id]}`), [], "over the get budget");
  assert.deepEqual(Object.keys(OVER).filter((id) => used[id]! <= BUDGET.get), [], "now within budget: take it off OVER");
});
