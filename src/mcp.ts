// MCP server: four tools, compact text answers. Text, not JSON, because agents read it and it costs fewer tokens.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pick, plan } from "./engine.ts";
import { formatLibrary, formatPlan, formatResources, formatTrending, line } from "./format.ts";
import { isResourceKind, resourceKinds } from "./registry/resources.ts";
import { aestheticIds, frameworks, kinds, type Aesthetic, type Library } from "./registry/schema.ts";

const INSTRUCTIONS = `tastebase is a curated index of UI libraries with notes on when to use each.
Before writing UI, do not build parts from scratch. Read the look from the user's words and the project (kit, fonts, colours), then call plan once with the whole brief, or pick for one specific job.
Call get for each library you will install; it returns usage and the agent note. Install it, then adapt the installed component to the look's type, colour and motion rules and the project's tokens. Write from scratch only what no library covers.
Call trending when asked what is hot.`;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function createServer(libs: Library[], looks: Aesthetic[], version: string): McpServer {
  const server = new McpServer({ name: "tastebase", version }, { instructions: INSTRUCTIONS });
  const byId = new Map(libs.map((l) => [l.id, l]));
  const lookById = new Map(looks.map((a) => [a.id, a]));
  const fw = z.enum(frameworks).optional().describe("Only libraries for this framework");

  server.registerTool(
    "plan",
    {
      description: "Pick libraries for a whole UI brief: detects the look, then returns one library per need with install commands and design rules.",
      inputSchema: {
        brief: z.string().describe("What is being built, in plain words, including any look: 'iOS-feel habit tracker with charts'"),
        framework: fw,
        look: z.enum(aestheticIds).optional().describe("Force a look instead of detecting it"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ brief, framework, look }) => text(formatPlan(plan(libs, looks, brief, { framework, look }))),
  );

  server.registerTool(
    "pick",
    {
      description: "Best 3 libraries for one UI job, e.g. 'copy button feedback', 'bottom sheet', 'hero shader background'.",
      inputSchema: {
        need: z.string(),
        framework: fw,
        look: z.enum(aestheticIds).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ need, framework, look }) => {
      const r = pick(libs, need, { framework, look: look ? lookById.get(look) : undefined });
      return text(r.length ? r.map(line).join("\n") : "No match. Try other words, or call plan with the whole brief.");
    },
  );

  server.registerTool(
    "get",
    {
      description: "Full entry for one library id (usage, agent note, alternatives), a look id for its design rules, or a resource category for linked design resources.",
      inputSchema: { id: z.string().describe(`Library id like 'vaul', look id like 'apple', or one of ${Object.keys(resourceKinds).join(", ")}`) },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const l = byId.get(id);
      if (l) return text(formatLibrary(l));
      const a = lookById.get(id as Aesthetic["id"]);
      if (isResourceKind(id)) return text(formatResources(id));
      if (a) return text(formatPlan({ look: a, lookGuessed: false, also: [], items: [], framework: "react", frameworkGuessed: true }).replace(/^framework:.*\n/m, "") + `\npicks: ${JSON.stringify(a.picks)}`);
      const near = [...byId.keys()].filter((k) => k.includes(id) || id.includes(k) || editDistance(k, id) <= 2).slice(0, 5);
      return text(`Unknown id "${id}".${near.length ? ` Did you mean: ${near.join(", ")}?` : ""}`);
    },
  );

  server.registerTool(
    "trending",
    {
      description: "UI libraries gaining the most GitHub stars this week, optionally for one kind or framework. Use when asked what is hot or new.",
      inputSchema: { kind: z.enum(kinds).optional(), framework: fw },
      annotations: { readOnlyHint: true },
    },
    async ({ kind, framework }) =>
      text(formatTrending(libs.filter((l) => (!kind || l.kind === kind) && (!framework || l.frameworks.includes(framework))))),
  );

  return server;
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}
