// Worker entry: Astro's request handler plus the hourly cron that refreshes trending stats.
import handler from "@alchemy.run/frontend-frameworks/astro/entrypoints/server";
import { libraries } from "../../src/registry/index.ts";
import { refreshStats, STATS_KEY, type Stats } from "../../src/trending.ts";
import type { WebsiteEnv } from "../../alchemy.run.ts";

export default {
  ...handler,
  async scheduled(_controller: ScheduledController, env: WebsiteEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const prev = (await env.STATS.get<Stats>(STATS_KEY, "json")) ?? {};
        const next = await refreshStats(libraries, prev, { githubToken: env.STATS_GITHUB_TOKEN, batch: 24 });
        await env.STATS.put(STATS_KEY, JSON.stringify(next));
      })(),
    );
  },
};
