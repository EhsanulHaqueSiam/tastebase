import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { STATS_KEY } from "../../../../src/trending.ts";

// GET /api/stats -> the cron's stats blob as-is. Pages are prerendered, so live numbers load from here.
export const GET: APIRoute = async () =>
  new Response((await env.STATS?.get(STATS_KEY)) ?? "{}", { headers: { "content-type": "application/json", "cache-control": "public, max-age=600" } });
