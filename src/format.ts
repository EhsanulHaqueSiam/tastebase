// Text formatting for tool answers. Kept free of server deps so the site can show exactly what agents get.
import { paywalled } from "./atlas.ts";
import type { Plan, Scored, kitParts } from "./engine.ts";
import { resourceKinds, resources, type Resource, type ResourceKind } from "./registry/resources.ts";
import type { Aesthetic, Framework, Kind, Library, SiteType } from "./registry/schema.ts";

const hot = (l: Library) => (l.stats?.starsWeek ? ` | +${l.stats.starsWeek}★ this week` : "");
/** The command that installs `l` in a plan: its build for the base kit (BlockNote on shadcn/ui), else for the framework. */
export const install = (l: Library, fw?: Framework, base?: Library) => (base && l.installWith?.[base.id]) || (fw && l.installFor?.[fw]) || l.install;

export const line = (s: Scored, fw?: Framework, base?: Library) =>
  `${s.lib.id}: ${s.lib.tagline}${s.why === s.lib.tagline ? "" : ` | why: ${s.why}`} | ${install(s.lib, fw, base)}${s.lib.paid ? ` | paid tier: ${s.lib.paid.price}` : ""}${hot(s.lib)}${s.caution ? ` | careful: ${s.caution}` : ""}`;

/** A `pick` answer: the fits, or the kits that ship the part when no library fits. */
export function formatPick(fits: Scored[], parts: ReturnType<typeof kitParts>, fw?: Framework): string {
  if (fits.length) return fits.map((s) => line(s, fw)).join("\n");
  if (parts.length) return `None curated for this job. Kits that ship it: ${parts.map((p) => `${p.lib.id} (${p.part})`).join(", ")}. Use the part from the project's kit.`;
  return "None curated for this job: use a dedicated library or build it. Other words, or plan with the whole brief, may find one.";
}

// Capped by count and length so one big kit cannot blow the get budget; still answers "does it have a combobox?" for most kits.
const list = (names: string[], cap: number, chars: number) => {
  let n = 0;
  for (let len = 0; n < Math.min(cap, names.length) && (len += names[n]!.length + 2) <= chars; ) n++;
  return names.slice(0, n).join(", ") + (names.length > n ? `, +${names.length - n} more` : "");
};

/** Libraries gaining the most GitHub stars this week. */
export function formatTrending(libs: Library[], limit = 10): string {
  const ranked = libs.filter((l) => (l.stats?.starsWeek ?? 0) > 0).sort((a, b) => b.stats!.starsWeek! - a.stats!.starsWeek!);
  if (!ranked.length) return "No trending data yet (stats refresh hourly).";
  return ranked
    .slice(0, limit)
    .map((l) => `${l.id} (${l.kind}): +${l.stats!.starsWeek}★ this week, ${l.stats!.stars ?? "?"}★ total${l.stats!.downloadsWeek ? `, ${l.stats!.downloadsWeek.toLocaleString("en")} npm/wk` : ""} | ${l.tagline}`)
    .join("\n");
}

// Design references to look at before building. Linked, never called: an agent with one of the MCPs uses its own.
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
// Reference MCPs in the order to try them (Mobbin, Refero, then Inspo, which is free); later ones are niche.
const mcps = resources.filter((r) => r.kind === "references" && r.mcp).slice(0, 3).map((r) => `${r.mcp!.name.replace(/ MCP$/, "")}${r.mcp!.needsPaidPlan ? "" : " (free)"}`);
// Free galleries that hand over a real site's DESIGN.md, for when no reference MCP is connected.
const designMd = resources.filter((r) => r.id === "refero-styles" || r.id === "devault").map((r) => host(r.url)).join(" or ");
const refs = (L: Aesthetic) =>
  `refs: name a real one first: the user's, else search ${mcps.slice(0, -1).join(", ")} or ${mcps.at(-1)} if connected, else ${L.references.slice(0, 2).map((r) => `${r.name} ${host(r.url)}`).join(", ")} or a DESIGN.md from ${designMd}, and say how to connect one (get references)`;

/** One resource category, for `get <category>`, in registry order (best first; paid ones say so). */
export const formatResources = (kind: ResourceKind) =>
  `${resourceKinds[kind]} (linked, not installed):\n` +
  resources
    .filter((r) => r.kind === kind)
    .map((r) => `${r.name} ${r.url} | ${r.goodFor} | ${r.cost}${r.mcp ? ` | ${r.mcp.name}${r.mcp.needsPaidPlan ? " (paid plan)" : ""}: ${r.mcp.url}` : ""}`)
    .join("\n");

/** What carries the page (3D, scroll motion, photo and video) and how to build it: a plan line, or `get <id>`. */
export const formatSite = (s: SiteType) => `site: ${s.name} (its rules beat the look's motion rule) | ${s.build} | avoid: ${s.avoid.join("; ")}`;

// The design rules every look answer starts with.
const rules = (L: Aesthetic) => [
  `vs: ${L.vs}`,
  `type: ${L.type}`,
  `colour: ${L.colour}`,
  `motion: ${L.motion}`,
  `avoid: ${L.avoid.join("; ")}`,
  refs(L),
];
const lookName = (L: Aesthetic) => `${L.name} (${L.id}${L.family ? `, ${L.family} family` : ""})`;

/** `get <look id>`: the look's rules and its picks per kind. */
export const formatLook = (L: Aesthetic) =>
  [`look: ${lookName(L)}: ${L.summary}`, ...rules(L), `picks: ${Object.entries(L.picks).map(([k, ids]) => `${k} ${ids!.length ? ids!.join(", ") : "none (plain CSS)"}`).join("; ")}`].join("\n");

/** `get looks`: every look id, styles grouped under their family. */
export const formatLooks = (looks: Aesthetic[]) =>
  "Pass one as look, or get <id> for its rules. family: its styles\n" +
  looks
    .filter((a) => !a.family)
    .map((f) => `${f.id}: ${looks.filter((s) => s.family === f.id).map((s) => s.id).join(", ") || "-"}`)
    .join("\n");

// What to build with when nothing curated fits a framework.
const DIY: Partial<Record<Framework, string>> = { "react-native": "React Native's Animated and Pressable, or Reanimated" };

// Reasons that say where a pick came from rather than what it does; the tagline says that.
const SOURCES = new Set(["look's pick", "look's own kit", "named in the brief"]);
/** A plan line: the use case it was picked for stands in for its tagline (get has the rest), and only a mostly paid
 * library names its price. */
const planLine = (s: Scored, fw: Framework, base?: Library) =>
  `${s.lib.id}: ${s.why === s.lib.tagline ? s.why : SOURCES.has(s.why) ? `${s.lib.tagline} (${s.why})` : s.why} | ${install(s.lib, fw, base)}${paywalled(s.lib) ? ` | mostly paid: ${s.lib.paid?.price}` : ""}${hot(s.lib)}${s.caution ? ` | careful: ${s.caution}` : ""}`;

/** A step the plan's installs need before anything else: shadcn registry adds fail on a fresh app until init runs. */
export function firstStep(p: Plan): string | undefined {
  const base = p.items[0]?.pick?.lib;
  const registry = p.items.some((it) => it.pick && /^npx shadcn@latest add/.test(install(it.pick.lib, p.framework, base)));
  return registry && !/shadcn@latest init/.test(base ? install(base, p.framework) : "") ? "npx shadcn@latest init -b base -p nova" : undefined;
}

/** What to do with a slot nothing curated fills: the look's own "no library", a framework gap, or a job we do not cover. */
export const emptySlot = (p: Plan, kind: Kind) =>
  p.look.picks[kind]?.length === 0 ? "no library in this look: plain CSS" : DIY[p.framework] ? `none curated for ${p.framework}; build it with ${DIY[p.framework]}` : "none curated for this; use a dedicated library or build it";

/** Phone screens: kit defaults (32px buttons, 16px checkboxes) fail touch, and the keyboard covers the field. */
export const MOBILE = "tap targets 44px or more (kit defaults are often 32px; size up buttons, checkboxes, toolbar icons), inputs 16px+ so iOS does not zoom, keep the focused field above the keyboard (viewport meta interactive-widget=resizes-content on the web)";

export function formatPlan(p: Plan): string {
  const base = p.items[0]?.pick?.lib;
  const out = [
    `look: ${lookName(p.look)}${p.lookGuessed ? "; none named in the brief, so defaulted: pass look to change" : ""}${p.also.length ? `; also fits: ${p.also.map((a) => a.id).join(", ")}` : ""}`,
    `framework: ${p.framework}${p.frameworkGuessed ? " (assumed; pass framework)" : ""}`,
    ...rules(p.look),
    ...(p.site ? [formatSite(p.site)] : []),
    ...(p.mobile ? [`mobile: ${MOBILE}`] : []),
    ...(p.darkOnLight ? ["dark: this look is light by default; keep its type, accent and rules, swap the ground to near-black (#0b0b0c), raise surfaces by lightness not shadow, text #ededed"] : []),
    ...(p.skipped.length ? [`left out (brief said no): ${p.skipped.join(", ")}`] : []),
    "",
  ];
  // shadcn registry installs fail on a fresh app until init has run; say it once, non-interactively.
  const init = firstStep(p);
  if (init) out.push(`first: ${init}`);
  for (const [i, it] of p.items.entries()) {
    const alts = it.alternatives.map((a) => a.lib.id).join(", ");
    const rest = alts ? ` | else: ${alts}` : "";
    if (i === 0 && p.uncurated) out.push(`${it.kind} -> ${p.uncurated} is not curated; keep the project's kit and use its parts`);
    else if (!it.pick)
      out.push(`${it.kind} -> ${emptySlot(p, it.kind)}`);
    else if (i > 0 && it.pick.lib === base) out.push(`${it.kind} -> ${base.id}: the base kit ships it${it.part ? ` (${it.part})` : ""}${rest}`);
    else out.push(`${it.kind} -> ${planLine(it.pick, p.framework, base)}${rest}`);
  }
  return out.join("\n");
}

export function formatLibrary(l: Library): string {
  const other = [...Object.entries(l.installFor ?? {}), ...Object.entries(l.installWith ?? {}).map(([kit, cmd]) => [`with ${kit}`, cmd])].map(([on, cmd]) => `${on}: ${cmd}`);
  return [
    `${l.name} (${l.id}) ${l.url}`,
    l.tagline,
    `kind: ${[l.kind, ...(l.alsoCovers ?? [])].join(", ")} | ${l.frameworks.join(", ")} | ${l.styling} | weight ${l.weight} | a11y ${l.a11y} | ${l.maturity}`,
    l.stats?.stars || l.stats?.downloadsWeek
      ? `adoption: ${[l.stats.stars && `${l.stats.stars.toLocaleString("en")}★`, l.stats.starsWeek && `+${l.stats.starsWeek}★ this week`, l.stats.downloadsWeek && `${l.stats.downloadsWeek.toLocaleString("en")} npm/wk`].filter(Boolean).join(", ")}`
      : "",
    l.paid ? `paid: ${l.paid.what} (${l.paid.price})` : "cost: free",
    l.parts ? `parts (${l.parts.free.length} free${l.parts.paid?.length ? `, ${l.parts.paid.length} paid` : ""}): ${list(l.parts.free, 40, 420)}${l.parts.paid?.length ? `; paid only: ${list(l.parts.paid, 12, 120)}` : ""}` : "",
    `install: ${l.install}`,
    other.length ? `install elsewhere: ${other.join(" | ")}` : "",
    `usage:\n${l.usage}`,
    `note: ${l.note}`,
    `use for: ${l.useFor.join("; ")}`,
    `avoid when: ${l.avoidWhen.join("; ")}`,
    l.pairsWith?.length ? `pairs with: ${l.pairsWith.join(", ")}` : "",
    l.alternatives?.length ? `alternatives: ${l.alternatives.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
