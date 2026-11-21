import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { VIEWS_KEY } from "../../../../src/trending.ts";

// GET /api/views -> {views, visitors} over the last 30 days, as the hourly cron last wrote them; {} before its first run.
export const GET: APIRoute = async () =>
  new Response((await env.STATS?.get(VIEWS_KEY)) ?? "{}", { headers: { "content-type": "application/json", "cache-control": "public, max-age=600" } });
