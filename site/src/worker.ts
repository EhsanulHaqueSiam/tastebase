// Worker entry: Astro's request handler, Markdown copies for AI crawlers, and the hourly cron that refreshes stats.
import handler from "@alchemy.run/frontend-frameworks/astro/entrypoints/server";
import type { WebsiteEnv } from "../../alchemy.run.ts";
import { runStatsRefresh } from "./lib/cron.ts";
import { markdownFor } from "./lib/negotiate.ts";

type Env = WebsiteEnv & { ASSETS: Fetcher };

export default {
  ...handler,
  // Pages run through the Worker first (alchemy.run.ts runWorkerFirst) only so an AI crawler, or a client asking for
  // text/markdown, gets the page's Markdown copy (site/build.ts) instead of its HTML. Everyone else falls through.
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const md = markdownFor(request);
    if (md) {
      const r = await env.ASSETS.fetch(new URL(md, request.url));
      if (r.ok) return new Response(r.body, { headers: { "content-type": "text/markdown; charset=utf-8", vary: "accept, user-agent", "x-robots-tag": "noindex", "cache-control": "public, max-age=600" } });
    }
    return handler.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: WebsiteEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runStatsRefresh(env));
  },
};
