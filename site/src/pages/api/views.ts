import type { APIRoute } from "astro";
import { VIEWS_KEY } from "../../../../src/trending.ts";
import { kvText } from "../../lib/server.ts";

// GET /api/views -> {views, visitors} over the last 30 days, as the hourly cron last wrote them; {} before its first run.
export const GET: APIRoute = async () =>
  new Response(await kvText(VIEWS_KEY), { headers: { "content-type": "application/json", "cache-control": "public, max-age=600" } });
