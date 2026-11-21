// The hourly stats refresh, shared by the Worker's scheduled() handler (production) and the dev-only
// /api/dev/cron route (local: Astro's dev server does not load the custom Worker entry).
import { libraries } from "../../../src/registry/index.ts";
import { fetchUsage, fetchViews, refreshStats, STATS_KEY, VIEWS_KEY, withUsage, type Stats } from "../../../src/trending.ts";
import type { WebsiteEnv } from "../../../alchemy.run.ts";

type Env = Pick<WebsiteEnv, "STATS" | "STATS_GITHUB_TOKEN" | "USAGE_DATASET" | "VIEWS_DATASET"> & { USAGE_API_TOKEN?: string; CF_ACCOUNT_ID?: string };

export async function runStatsRefresh(env: Env, batch = 24) {
  const prev = (await env.STATS.get<Stats>(STATS_KEY, "json")) ?? {};
  let next = await refreshStats(libraries, prev, { githubToken: env.STATS_GITHUB_TOKEN, batch });
  // Two more subrequests when the read token is set; a failed read keeps last hour's counts.
  const sql = env.USAGE_API_TOKEN && env.CF_ACCOUNT_ID ? { accountId: env.CF_ACCOUNT_ID, token: env.USAGE_API_TOKEN } : undefined;
  const [uses, views] = sql ? await Promise.all([fetchUsage({ ...sql, dataset: env.USAGE_DATASET }), fetchViews({ ...sql, dataset: env.VIEWS_DATASET })]) : [];
  if (uses) next = withUsage(next, uses);
  await env.STATS.put(STATS_KEY, JSON.stringify(next));
  if (views) await env.STATS.put(VIEWS_KEY, JSON.stringify(views)); // one more KV write an hour, 24 of the 1,000 a day
  return { refreshed: Object.values(next).filter((s) => s.updatedAt && s.updatedAt === new Date().toISOString().slice(0, 10)).length, total: Object.keys(next).length, usage: !!uses, views: !!views };
}
