// Token budget for what agents read. tastebase exists to save agents tokens, so tool schemas and typical
// answers must stay small. Raising a budget is a deliberate decision: say why in the PR.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
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
    get: Math.max(...(await Promise.all(["shadcn-ui", "aceternity-ui", "motion", "paper-shaders", "vaul"].map(async (id) => tokens(await text("get", { id })))))),
  };
  await client.close();
  for (const k of Object.keys(BUDGET) as (keyof typeof BUDGET)[]) assert.ok(used[k] <= BUDGET[k], `${k}: ${used[k]} tokens > budget ${BUDGET[k]}`);
});
