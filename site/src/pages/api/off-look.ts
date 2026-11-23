import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { offLookCounts } from "../../lib/auth-data.ts";

// GET /api/off-look -> [{item, look, users}]: how many users' agents marked a library or part wrong for a look (the
// `taste` tool), most first. Counts only, never who. tune-picks reads it to fix a look's picks and a library's tags.
export const GET: APIRoute = async () =>
  Response.json(await offLookCounts(env.DB), { headers: { "cache-control": "public, max-age=3600" } });
