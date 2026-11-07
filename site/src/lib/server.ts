// Server-only: the registry, the engine and live stats. Islands never import this; they get props or call /api.
import { env } from "cloudflare:workers";
import { pick, plan } from "../../../src/engine.ts";
import { aesthetics, libraries } from "../../../src/registry/index.ts";
import type { Framework, Kind, Library } from "../../../src/registry/schema.ts";
import { STATS_KEY, withStats, type Stats } from "../../../src/trending.ts";

export { aesthetics };

/** Registry merged with the latest stats the cron wrote. Missing stats (first deploy, local dev) are fine. */
export async function getLibraries(): Promise<Library[]> {
  const stats = await env.STATS?.get<Stats>(STATS_KEY, "json").catch(() => null);
  return withStats(libraries, stats ?? {});
}

/** What a card or list row needs. */
export type Lite = Pick<Library, "id" | "name" | "tagline" | "kind" | "install"> & { hot: boolean };
export const lite = (l: Library): Lite => ({ id: l.id, name: l.name, tagline: l.tagline, kind: l.kind, install: l.install, hot: (l.stats?.starsWeek ?? 0) >= 150 });

export type PlanJson = {
  look: { name: string; summary: string; type: string; colour: string; motion: string };
  framework: Framework;
  items: { kind: Kind; lib: Lite; why: string }[];
};

export function planJson(libs: Library[], brief: string): PlanJson {
  const p = plan(libs, aesthetics, brief);
  const { name, summary, type, colour, motion } = p.look;
  return {
    look: { name, summary, type, colour, motion },
    framework: p.framework,
    items: p.items.flatMap((i) => (i.pick ? [{ kind: i.kind, lib: lite(i.pick.lib), why: i.pick.why }] : [])),
  };
}

export const pickJson = (libs: Library[], need: string) => pick(libs, need, { limit: 5 }).map((s) => ({ lib: lite(s.lib), why: s.why }));
