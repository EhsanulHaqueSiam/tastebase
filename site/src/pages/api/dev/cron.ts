// Local only: runs the cron body against the dev KV. `import.meta.env.DEV` is false in production builds,
// so the route compiles to a 404 there. Usage: curl "localhost:<port>/api/dev/cron?batch=80"
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { runStatsRefresh } from "../../../lib/cron.ts";

export const GET: APIRoute = async ({ url }) => {
  if (!import.meta.env.DEV) return new Response("Not found", { status: 404 });
  return Response.json(await runStatsRefresh(env, Number(url.searchParams.get("batch") ?? 24)));
};
