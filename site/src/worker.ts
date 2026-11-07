// Worker entry: Astro's request handler plus the hourly cron that refreshes trending stats.
import handler from "@alchemy.run/frontend-frameworks/astro/entrypoints/server";
import type { WebsiteEnv } from "../../alchemy.run.ts";
import { runStatsRefresh } from "./lib/cron.ts";

export default {
  ...handler,
  async scheduled(_controller: ScheduledController, env: WebsiteEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runStatsRefresh(env));
  },
};
