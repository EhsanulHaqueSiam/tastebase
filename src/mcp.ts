// MCP server: five tools, compact text answers. Text, not JSON, because agents read it and it costs fewer tokens.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { detectFramework, detectLooks, kitParts, negations, pick, plan, words } from "./engine.ts";
import { formatIntegrations, formatLibrary, formatLook, formatLooks, formatPick, formatPlan, formatResources, formatSite, formatTrending, SITE } from "./format.ts";
import { siteTypes } from "./registry/index.ts";
import { agentResourceKinds, isResourceKind, resources } from "./registry/resources.ts";
import { frameworks, kinds, type Aesthetic, type Framework, type Library } from "./registry/schema.ts";
import { partOf, partSlug, tasteActions, without, type Taste, type TasteAction } from "./taste.ts";

export type { Taste } from "./taste.ts";

/** Hash of skills/tastebase/SKILL.md, which states it too; src/skill.test.ts says what to set after editing the skill. */
export const SKILL_VERSION = "17d4593";

export const INSTRUCTIONS = `tastebase is a curated index of UI libraries with notes on when to use each.
Before writing UI, do not build parts from scratch: call pick for one specific job (a toast), or plan once with the whole brief. Read the look from the user's words and the project (kit, fonts, colours); get looks lists every look id. For fonts, colour or references, get that category.
Reference first: before building a screen, name a real one: the user's, else search Mobbin, Refero or Inspo (free) if connected, else the look's refs.
Build each part a plan lists with its library, from the usage shown. Adapt it to the look's type, colour and motion rules and the project's tokens; set a kit's radius, fonts and neutrals first. Write from scratch only what no library covers.
Before calling UI done, screenshot it at desktop and ~390px and compare with the reference. Check: one focal point, at most one showpiece effect per page, gaps on a 4/8px scale, hierarchy from weight and colour before size, one accent on tinted neutrals, real content, matching radius, borders and shadows, motion that starts where the user acted. The look's rules win where they differ.
Call trending when asked what is hot. When the user rejects a library or part ("never recommend X", "X clashes with this look"), save it with taste, not a memory note: it follows them to every project.
Skill version ${SKILL_VERSION}; if yours differs, update it per tastebase.ehsanulsiam.workers.dev/llms.txt.`;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

// MCP Apps: hosts that render them show a library's live demo in the chat when an agent calls `get <id>`; others
// ignore it and read the text. The view takes the id from the answer's first line and frames /embed/<id>. Hand-written
// bridge (initialize, initialized, tool-result, size-changed) instead of the 540 KB ext-apps bundle.
const VIEW_URI = "ui://tastebase/lib";
const VIEW = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}iframe{display:block;width:100%;height:480px;border:0;border-radius:12px}</style>
<iframe id="f" title="Live preview" hidden></iframe>
<script>
const post = (m) => parent.postMessage({ jsonrpc: "2.0", ...m }, "*");
addEventListener("message", (e) => {
  const m = e.data;
  if (!m || m.jsonrpc !== "2.0") return;
  if (m.id === 1 && m.result) post({ method: "ui/notifications/initialized", params: {} });
  if (m.method !== "ui/notifications/tool-result") return;
  const t = (m.params?.content ?? []).map((c) => c.text ?? "").join("\\n");
  const id = t.match(/^[^\\n]* \\(([a-z0-9.-]+)\\) https?:/)?.[1];
  const f = document.getElementById("f");
  if (id) (f.src = "${SITE}/embed/" + id), (f.hidden = false);
  post({ method: "ui/notifications/size-changed", params: { height: id ? 480 : 0 } });
});
post({ id: 1, method: "ui/initialize", params: { protocolVersion: "2026-01-26", appInfo: { name: "tastebase", version: "1" }, appCapabilities: {} } });
</script>`;

const SAVED: Record<TasteAction, (id: string, look?: string) => string> = {
  hide: (id) => `Saved: ${id} is hidden; plan, pick and get leave it out from the next call.`,
  like: (id) => `Saved: ${id} is liked; it leads close calls in plan and pick.`,
  "off-look": (id, look) => `Saved: ${id} is left out under ${look} only and still offered for other looks.`,
  undo: (id) => `Saved: ${id} is offered again under every look, and no longer liked.`,
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Free text can still name what the user hid or marked off this look (a note's "use motion-primitives", a look's picks,
// a kit whose part they hid); an answer that names it by id or name says so at the end.
function withTasteNotes(all: Library[], taste: Taste | undefined, t: string, look?: string) {
  const named = (ids: Iterable<string>) =>
    [...ids].filter((id) => {
      const l = all.find((x) => x.id === (partOf(all, id)?.lib.id ?? id));
      return [l?.id ?? id, l?.name].some((n) => n && new RegExp(`(?<![\\w.-])${esc(n)}(?![\\w-])`).test(t));
    });
  const them = (ids: string[]) => (ids.length > 1 ? "them" : "it");
  const hide = taste?.hide ?? new Set<string>();
  // A hidden library's features go with it (GSAP's SplitText), as in `without`.
  const hid = named([...hide, ...all.filter((l) => l.partOf && hide.has(l.partOf)).map((l) => l.id)]);
  const off = named(taste?.offLook?.get(look ?? "") ?? []).filter((id) => !hid.includes(id));
  return [t, hid.length && `the user hid ${hid.join(", ")}: never use ${them(hid)}`, off.length && `the user marked ${off.join(", ")} wrong for the ${look} look: do not use ${them(off)} here`]
    .filter(Boolean)
    .join("\n");
}

/** The `plan` tool's answer for a brief under a user's taste, as the agent reads it; the site's "try your agent" shows
 *  the same text. `look` must be a known id. */
export function planAnswer(all: Library[], looks: Aesthetic[], args: { brief: string; framework?: Framework; look?: string }, taste?: Taste, onUse?: (id: string) => void) {
  const libs = without(all, taste?.hide);
  const opts = { framework: args.framework, look: args.look, like: taste?.like, prefer: taste };
  const first = plan(libs, looks, args.brief, opts);
  // Off-look marks hold only under their look, which the first plan settles.
  const off = taste?.offLook?.get(first.look.id);
  const p = off?.size ? plan(without(libs, off), looks, args.brief, opts) : first;
  p.items.forEach((i) => i.pick && onUse?.(i.pick.lib.id));
  return withTasteNotes(all, taste, formatPlan(p), first.look.id);
}

/** `onUse` hears each library an agent reads (`get`) or is offered (`plan`, `pick`); the hosted server counts them. */
export function createServer(all: Library[], looks: Aesthetic[], version: string, onUse?: (id: string) => void, taste?: Taste): McpServer {
  const libs = without(all, taste?.hide);
  const like = taste?.like;
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
  const reply = (t: string, look?: string) => text(withTasteNotes(all, taste, t, look));

  server.registerTool(
    "plan",
    {
      description: "Call first for any page or screen, before writing it: detects the look from the brief, then returns a library for each job with its install and usage, then the look's design rules.",
      inputSchema: {
        brief: z.string().describe("What is being built, its look and the project's stack: 'iOS-feel habit tracker with charts, Vite + React + Tailwind'"),
        framework: fw,
        look: lookArg,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ brief, framework, look }) => (look && !lookById.has(look) ? unknownLook(look) : text(planAnswer(all, looks, { brief, framework, look }, taste, onUse))),
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
      // The look passed, else the one the job names ("minimal dashboard toast", not "not minimal"), else the user's saved
      // look: it ranks the picks and its off-look marks apply.
      const look = lookById.get(id ?? detectLooks(looks, negations(need).want)[0]?.id ?? taste?.look ?? "");
      const lookId = look?.id;
      // The job's own framework when none is passed ("a React date picker" never gets Vue-only answers), else the saved one.
      const fw = framework ?? detectFramework(negations(need).want) ?? taste?.framework ?? "react";
      const off = taste?.offLook?.get(lookId ?? "");
      const pool = off ? without(libs, off) : libs;
      const fits = pick(pool, need, { framework: fw, look, like });
      fits.forEach((s) => onUse?.(s.lib.id));
      const parts = kitParts(pool, need, { framework: fw, look });
      // The project wins: a kit the job names that ships the part ("date picker, we use shadcn") answers first.
      const said = words(need);
      const own = parts.find((p) => said.includes(words(p.lib.name)) || said.includes(words(p.lib.id.replace(/-ui$/, ""))));
      const lead = own ? `Your kit ships it: ${own.lib.id} (${own.part}). Use that; the rest only if it falls short.\n` : "";
      return reply(lead + formatPick(fits, fits.length ? [] : parts, fw), lookId);
    },
  );

  server.registerTool(
    "get",
    {
      description: "Full entry for one library id (usage, agent note, alternatives), a look id for its design rules, looks for every look id, a site type (3d-site, motion-site, media-site) for its build rules, or a resource category for linked design resources.",
      inputSchema: { id: z.string().describe(`Library id ('vaul'), look id ('apple'), looks, or one of ${[...agentResourceKinds, "integrations"].join(", ")}`) },
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: VIEW_URI } },
    },
    async ({ id }) => {
      const l = byId.get(id);
      if (l) return onUse?.(l.id), reply(formatLibrary(l));
      const site = siteTypes.find((t) => t.id === id);
      if (site) return reply(`${formatSite(site)}\npicks: ${JSON.stringify(site.picks)}`);
      if (isResourceKind(id)) return text(formatResources(id, taste?.hide));
      if (id === "integrations") return text(formatIntegrations());
      if (id === "looks") return text(formatLooks(looks));
      const a = lookById.get(id);
      if (a) return reply(formatLook(a), a.id);
      const close = near(id, [...byId.keys(), ...lookById.keys()]);
      return reply(`Unknown id "${id}".${close.length ? ` Did you mean: ${close.join(", ")}?` : ""}`);
    },
  );

  server.registerResource("Library preview", VIEW_URI, { mimeType: "text/html;profile=mcp-app" }, async () => ({
    contents: [{ uri: VIEW_URI, mimeType: "text/html;profile=mcp-app", text: VIEW, _meta: { ui: { csp: { frameDomains: [SITE] } } } }],
  }));

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

  server.registerTool(
    "taste",
    {
      description: "Save the user's verdict on a library or kit part (id 'kokonut-ui/pull-cord') to their tastebase account; plan, pick and get follow it in every project. Use it, not a memory note, for 'never recommend X' (hide) or 'X clashes with this look' (off-look, pass look).",
      inputSchema: { id: z.string(), action: z.enum(tasteActions), look: z.string().optional() },
    },
    async ({ id, action, look }) => {
      const lib = all.find((l) => l.id === id);
      const part = lib ? undefined : partOf(all, id);
      const resource = lib || part ? undefined : resources.find((r) => r.id === id);
      if (!lib && !part && !resource) {
        const [libId = ""] = id.split("/");
        const kit = id.includes("/") ? all.find((l) => l.id === libId) : undefined;
        const close = kit ? near(partSlug(id.slice(libId.length + 1)), [...(kit.parts?.free ?? []), ...(kit.parts?.paid ?? [])].map(partSlug)).map((s) => `${libId}/${s}`) : near(id, all.map((l) => l.id));
        return text(`Unknown id "${id}".${close.length ? ` Did you mean: ${close.join(", ")}?` : ""} A part is library/part, its name in lowercase with dashes.`);
      }
      if (action === "like" && !lib) return text("Only a whole library can be liked; hide works for parts and resources too.");
      if (action === "off-look") {
        if (resource) return text("A resource has no look; hide it instead.");
        if (!look) return text("off-look needs the look id it clashes with; get looks lists them.");
        if (!lookById.has(look)) return unknownLook(look);
      }
      if (!taste?.save) {
        const now = action === "hide" ? ` Leave ${id} out for the rest of this chat.` : action === "off-look" ? ` Leave ${id} out under ${look} for the rest of this chat.` : "";
        return text(`Not saved: this connection has no tastebase agent key.${now} To keep it, the user signs in at ${SITE}, makes an agent key in their account and reconnects with it.`);
      }
      await taste.save(id, action, action === "off-look" ? look : undefined);
      // An off-look mark on a hidden item changes nothing yet: it stays hidden everywhere until undone.
      if (action === "off-look" && taste.hide.has(id)) return text(`Saved: ${id} is marked wrong for ${look}, and stays hidden under every look until undone.`);
      return text(SAVED[action](id, look));
    },
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
