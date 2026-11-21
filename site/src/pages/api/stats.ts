import type { APIRoute } from "astro";
import { STATS_KEY } from "../../../../src/trending.ts";
import { kvText } from "../../lib/server.ts";

// GET /api/stats -> the cron's stats blob as-is. Pages are prerendered, so live numbers load from here.
export const GET: APIRoute = async () =>
  new Response(await kvText(STATS_KEY), { headers: { "content-type": "application/json", "cache-control": "public, max-age=600" } });
