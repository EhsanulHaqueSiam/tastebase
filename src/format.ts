// Text formatting for tool answers. Kept free of server deps so the site can show exactly what agents get.
import type { Plan, Scored } from "./engine.ts";
import { resources, type Resource } from "./registry/resources.ts";
import type { Library } from "./registry/schema.ts";

const hot = (l: Library) => (l.stats?.starsWeek ? ` | +${l.stats.starsWeek}★ this week` : "");

export const line = (s: Scored) =>
  `${s.lib.id}: ${s.lib.tagline} | why: ${s.why} | ${s.lib.install}${s.lib.paid ? ` | paid tier: ${s.lib.paid.price}` : ""}${hot(s.lib)}${s.caution ? ` | careful: ${s.caution}` : ""}`;

// Capped so one big kit cannot blow the get budget; the cap still answers "does it have a combobox?" for most kits.
const list = (names: string[], cap: number) => names.slice(0, cap).join(", ") + (names.length > cap ? `, +${names.length - cap} more` : "");

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
const freeHosts = (kind: Resource["kind"]) => resources.filter((r) => r.kind === kind && r.free).slice(0, 2).map((r) => host(r.url)).join(", ");
// The first three reference MCPs (Inspo, Mobbin, Refero) search screens; later ones are niche and would cost tokens on every plan.
const refs = `refs: if you have ${resources.filter((r) => r.kind === "references" && r.mcp).slice(0, 3).map((r) => r.mcp!.name).join(" or ")}, search it for this brief's screens; free: ${freeHosts("references")}; fonts: ${freeHosts("fonts")}; colour: ${freeHosts("colour")}`;

export function formatPlan(p: Plan): string {
  const L = p.look;
  const out = [
    `look: ${L.name}${p.lookGuessed ? " (no look named in brief; defaulted, pass look to change)" : ""}${p.also.length ? `; also fits: ${p.also.map((a) => a.id).join(", ")}` : ""}`,
    `framework: ${p.framework}${p.frameworkGuessed ? " (assumed; pass framework if not)" : ""}`,
    `type: ${L.type}`,
    `colour: ${L.colour}`,
    `motion: ${L.motion}`,
    `avoid: ${L.avoid.join("; ")}`,
    refs,
    "",
  ];
  for (const it of p.items) {
    if (!it.pick) {
      out.push(`${it.kind} -> none curated for ${p.framework}; build it with plain CSS or ask for another framework`);
      continue;
    }
    const alts = it.alternatives.map((a) => a.lib.id).join(", ");
    out.push(`${it.kind} -> ${line(it.pick)}${alts ? ` | else: ${alts}` : ""}`);
  }
  return out.join("\n");
}

export function formatLibrary(l: Library): string {
  return [
    `${l.name} (${l.id}) ${l.url}`,
    l.tagline,
    `kind: ${[l.kind, ...(l.alsoCovers ?? [])].join(", ")} | ${l.frameworks.join(", ")} | ${l.styling} | weight ${l.weight} | a11y ${l.a11y} | ${l.maturity}`,
    l.stats?.stars || l.stats?.downloadsWeek
      ? `adoption: ${[l.stats.stars && `${l.stats.stars.toLocaleString("en")}★`, l.stats.starsWeek && `+${l.stats.starsWeek}★ this week`, l.stats.downloadsWeek && `${l.stats.downloadsWeek.toLocaleString("en")} npm/wk`].filter(Boolean).join(", ")}`
      : "",
    `cost: ${l.paid ? `free core; paid: ${l.paid.what} (${l.paid.price})` : "free"}`,
    l.parts ? `parts (${l.parts.free.length} free${l.parts.paid?.length ? `, ${l.parts.paid.length} paid` : ""}): ${list(l.parts.free, 40)}${l.parts.paid?.length ? `; paid only: ${list(l.parts.paid, 12)}` : ""}` : "",
    `install: ${l.install}`,
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
