// Server-only: the registry, the engine and live stats. Islands import only its types; they get props or call /api.
import { env } from "cloudflare:workers";
import { jobFramework, pick, plan } from "../../../src/engine.ts";
import { emptySlot, firstStep, formatSite, install, MOBILE } from "../../../src/format.ts";
import { aesthetics, libraries } from "../../../src/registry/index.ts";
import { kinds, type Aesthetic, type Framework, type Kind, type Library } from "../../../src/registry/schema.ts";
import { STATS_KEY, withStats, type Stats } from "../../../src/trending.ts";
import { kindMeta } from "./kinds.ts";

export { aesthetics, libraries };

// Fill the engine's parse caches while the Worker starts (startup CPU has its own limit), so the first request's
// plan costs ~1ms instead of ~8ms against the 10ms per-request limit.
plan(libraries, aesthetics, "warm-up: landing page dashboard with charts");
pick(libraries, "toast");

/** Registry merged with the latest stats the cron wrote. Missing stats (first deploy, local dev) are fine. */
export async function getLibraries(): Promise<Library[]> {
  const stats = await env.STATS?.get<Stats>(STATS_KEY, "json").catch(() => null);
  return withStats(libraries, stats ?? {});
}

/** What a card or list row needs. */
export type Lite = Pick<Library, "id" | "name" | "tagline" | "kind" | "install">;
export const lite = ({ id, name, tagline, kind, install }: Library): Lite => ({ id, name, tagline, kind, install });

/** A home shelf card: what it shows and what its filters read. */
export const shelfLib = ({ id, name, tagline, kind, frameworks, aesthetic }: Library) => ({ id, name, tagline, kind, frameworks, aesthetic });
export type ShelfLib = ReturnType<typeof shelfLib>;

/** A look as a shelf chip: its swatch, the words that find it, and every library it picks. */
export const lookChip = ({ id, name, family, swatch, signals, picks }: Aesthetic) => ({
  id,
  name,
  family,
  bg: swatch.bg,
  accent: swatch.accent,
  signals,
  picks: [...new Set(Object.values(picks).flatMap((ids) => ids ?? []))],
});
export type LookChip = ReturnType<typeof lookChip>;

const libName = new Map(libraries.map((l) => [l.id, l.name]));
/** A look's panel on /looks. Picks are [kind label, [lib id, lib name][]] in kind order, unknown ids dropped. */
export const lookDetail = ({ name, family, summary, vs, type, colour, motion, avoid, signals, references, picks }: Aesthetic) => ({
  name,
  family,
  summary,
  vs,
  type,
  colour,
  motion,
  avoid,
  signals,
  references,
  picks: kinds.flatMap((k) => {
    const ls = (picks[k] ?? []).flatMap((id) => (libName.has(id) ? [[id, libName.get(id)!] as const] : []));
    return ls.length ? [[kindMeta[k].label, ls] as const] : [];
  }),
});
export type LookDetail = ReturnType<typeof lookDetail>;

/** The plan as the site shows it, with the same caveats agents read in `formatPlan`. No `pick`: nothing curated fits. */
export type PlanJson = {
  look: { name: string; summary: string; type: string; colour: string; motion: string; avoid: string[]; guessed: boolean; also: string[] };
  framework: Framework;
  frameworkGuessed: boolean;
  /** A step before the installs (shadcn init for registry kits), as agents get it. */
  first?: string;
  mobile?: string;
  /** What carries the page (3D, scroll motion, media) and how to build it. */
  site?: string;
  items: { kind: Kind; pick?: { lib: Lite; why: string; caution?: string }; empty?: string }[];
};

export function planJson(libs: Library[], brief: string): PlanJson {
  const p = plan(libs, aesthetics, brief);
  const { name, summary, type, colour, motion, avoid } = p.look;
  const base = p.items[0]?.pick?.lib;
  return {
    look: { name, summary, type, colour, motion, avoid, guessed: p.lookGuessed, also: p.also.map((a) => a.name) },
    framework: p.framework,
    frameworkGuessed: p.frameworkGuessed,
    first: firstStep(p),
    mobile: p.mobile ? MOBILE : undefined,
    site: p.site && formatSite(p.site).replace(/^site: /, ""),
    // The install and empty-slot text agents read in formatPlan: BlockNote on shadcn/ui, Lucide on Vue.
    items: p.items.map(({ kind, pick: s }) => ({ kind, pick: s && { lib: { ...lite(s.lib), install: install(s.lib, p.framework, base) }, why: s.why, caution: s.caution }, empty: s ? undefined : emptySlot(p, kind) })),
  };
}

// Same framework rule and install resolution as the MCP `pick` tool ("Vue bottom sheet" never gets React-only answers).
export function pickJson(libs: Library[], need: string) {
  const framework = jobFramework(need);
  return pick(libs, need, { limit: 5, framework }).map((s) => ({ lib: { ...lite(s.lib), install: install(s.lib, framework) }, why: s.why }));
}
