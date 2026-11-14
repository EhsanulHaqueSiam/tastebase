// MCP server: four tools, compact text answers. Text, not JSON, because agents read it and it costs fewer tokens.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { detectLooks, jobFramework, kitParts, pick, plan, words } from "./engine.ts";
import { formatLibrary, formatLook, formatLooks, formatPick, formatPlan, formatResources, formatSite, formatTrending } from "./format.ts";
import { siteTypes } from "./registry/index.ts";
import { agentResourceKinds, isResourceKind } from "./registry/resources.ts";
import { frameworks, kinds, type Aesthetic, type Library } from "./registry/schema.ts";

/** Hash of skills/tastebase/SKILL.md, which states it too; src/skill.test.ts says what to set after editing the skill. */
export const SKILL_VERSION = "e3dced5";

export const INSTRUCTIONS = `tastebase is a curated index of UI libraries with notes on when to use each.
Before writing UI, do not build parts from scratch: call pick for one specific job (a toast), or plan once with the whole brief. Read the look from the user's words and the project (kit, fonts, colours); get looks lists every look id. For fonts, colour or references, get that category.
Reference first: before building a screen, name a real one: the user's, else search Mobbin, Refero or Inspo (free) if connected, else the look's refs.
Call get for each library you will install and follow its usage and note. Adapt it to the look's type, colour and motion rules and the project's tokens; set a kit's radius, fonts and neutrals first. Write from scratch only what no library covers.
Before calling UI done, screenshot it at desktop and ~390px and compare with the reference. Check: one focal point, at most one showpiece effect per page, gaps on a 4/8px scale, hierarchy from weight and colour before size, one accent on tinted neutrals, real content, matching radius, borders and shadows, motion that starts where the user acted. The look's rules win where they differ.
Call trending when asked what is hot.
Skill version ${SKILL_VERSION}; if yours differs, update it per tastebase.ehsanulsiam.workers.dev/llms.txt.`;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

export function createServer(libs: Library[], looks: Aesthetic[], version: string): McpServer {
  const server = new McpServer({ name: "tastebase", version }, { instructions: INSTRUCTIONS });
  const byId = new Map(libs.map((l) => [l.id, l]));
  const lookById = new Map(looks.map((a) => [a.id, a]));
  const fw = z.enum(frameworks).optional().describe("Only libraries for this framework");
  const lookArg = z.string().optional().describe("Look id (get looks lists them); detected from the brief when left out");
  const near = (id: string, ids: Iterable<string>) => [...ids].filter((k) => k.includes(id) || id.includes(k) || editDistance(k, id) <= 2).slice(0, 5);
  const unknownLook = (id: string) => {
    // Looks whose signals the id names ("liquid-glass" -> glass), then ids spelled close to it.
    const close = [...new Set([...detectLooks(looks, id).map((a) => a.id), ...near(id, lookById.keys())])].slice(0, 5);
    return text(`Unknown look "${id}".${close.length ? ` Closest: ${close.join(", ")}.` : ""} get looks lists every id.`);
  };

  server.registerTool(
    "plan",
    {
      description: "Call first for any page or screen, before writing it: detects the look from the brief, then returns one library per need with install commands, then the look's design rules.",
      inputSchema: {
        brief: z.string().describe("What is being built, in plain words, including any look: 'iOS-feel habit tracker with charts'"),
        framework: fw,
        look: lookArg,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ brief, framework, look }) => (look && !lookById.has(look) ? unknownLook(look) : text(formatPlan(plan(libs, looks, brief, { framework, look })))),
  );

  server.registerTool(
    "pick",
    {
      description: "Best 3 libraries for one UI job, e.g. 'copy button feedback', 'bottom sheet', 'hero shader background'.",
      inputSchema: { need: z.string(), framework: fw, look: lookArg },
      annotations: { readOnlyHint: true },
    },
    async ({ need, framework, look: id }) => {
      if (id && !lookById.has(id)) return unknownLook(id);
      const look = id ? lookById.get(id) : undefined;
      // The job's own framework when none is passed ("a React date picker" never gets Vue-only answers).
      const fw = framework ?? jobFramework(need);
      const fits = pick(libs, need, { framework: fw, look });
      const parts = kitParts(libs, need, { framework: fw, look });
      // The project wins: a kit the job names that ships the part ("date picker, we use shadcn") answers first.
      const said = words(need);
      const own = parts.find((p) => said.includes(words(p.lib.name)) || said.includes(words(p.lib.id.replace(/-ui$/, ""))));
      const lead = own ? `Your kit ships it: ${own.lib.id} (${own.part}). Use that; the rest only if it falls short.\n` : "";
      return text(lead + formatPick(fits, fits.length ? [] : parts, fw));
    },
  );

  server.registerTool(
    "get",
    {
      description: "Full entry for one library id (usage, agent note, alternatives), a look id for its design rules, looks for every look id, a site type (3d-site, motion-site, media-site) for its build rules, or a resource category for linked design resources.",
      inputSchema: { id: z.string().describe(`Library id like 'vaul', look id like 'apple', looks, or one of ${agentResourceKinds.join(", ")}`) },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const l = byId.get(id);
      if (l) return text(formatLibrary(l));
      const site = siteTypes.find((t) => t.id === id);
      if (site) return text(`${formatSite(site)}\npicks: ${JSON.stringify(site.picks)}`);
      if (isResourceKind(id)) return text(formatResources(id));
      if (id === "looks") return text(formatLooks(looks));
      const a = lookById.get(id);
      if (a) return text(formatLook(a));
      const close = near(id, [...byId.keys(), ...lookById.keys()]);
      return text(`Unknown id "${id}".${close.length ? ` Did you mean: ${close.join(", ")}?` : ""}`);
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
