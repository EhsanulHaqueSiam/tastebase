// The hourly stats refresh, shared by the Worker's scheduled() handler (production) and the dev-only
// /api/dev/cron route (local: Astro's dev server does not load the custom Worker entry).
import { libraries } from "../../../src/registry/index.ts";
import { refreshStats, STATS_KEY, type Stats } from "../../../src/trending.ts";
import type { WebsiteEnv } from "../../../alchemy.run.ts";

export async function runStatsRefresh(env: Pick<WebsiteEnv, "STATS" | "STATS_GITHUB_TOKEN">, batch = 24) {
  const prev = (await env.STATS.get<Stats>(STATS_KEY, "json")) ?? {};
  const next = await refreshStats(libraries, prev, { githubToken: env.STATS_GITHUB_TOKEN, batch });
  await env.STATS.put(STATS_KEY, JSON.stringify(next));
  return { refreshed: Object.values(next).filter((s) => s.updatedAt && s.updatedAt === new Date().toISOString().slice(0, 10)).length, total: Object.keys(next).length };
}
