// The hourly stats refresh, shared by the Worker's scheduled() handler (production) and the dev-only
// /api/dev/cron route (local: Astro's dev server does not load the custom Worker entry).
import { libraries } from "../../../src/registry/index.ts";
import { fetchUsage, refreshStats, STATS_KEY, withUsage, type Stats } from "../../../src/trending.ts";
import type { WebsiteEnv } from "../../../alchemy.run.ts";

type Env = Pick<WebsiteEnv, "STATS" | "STATS_GITHUB_TOKEN" | "USAGE_DATASET"> & { USAGE_API_TOKEN?: string; CF_ACCOUNT_ID?: string };

export async function runStatsRefresh(env: Env, batch = 24) {
  const prev = (await env.STATS.get<Stats>(STATS_KEY, "json")) ?? {};
  let next = await refreshStats(libraries, prev, { githubToken: env.STATS_GITHUB_TOKEN, batch });
  // One more subrequest when the read token is set; a failed read keeps last hour's counts.
  const uses = env.USAGE_API_TOKEN && env.CF_ACCOUNT_ID ? await fetchUsage({ accountId: env.CF_ACCOUNT_ID, token: env.USAGE_API_TOKEN, dataset: env.USAGE_DATASET }) : undefined;
  if (uses) next = withUsage(next, uses);
  await env.STATS.put(STATS_KEY, JSON.stringify(next));
  return { refreshed: Object.values(next).filter((s) => s.updatedAt && s.updatedAt === new Date().toISOString().slice(0, 10)).length, total: Object.keys(next).length, usage: !!uses };
}
