import type { APIRoute } from "astro";
import { getLibraries, planJson } from "../../lib/server.ts";

// GET /api/plan?brief=... -> the same stack the MCP `plan` tool returns, as JSON for the site.
export const GET: APIRoute = async ({ url }) => {
  const brief = url.searchParams.get("brief")?.slice(0, 500) ?? "";
  return Response.json(planJson(await getLibraries(), brief), { headers: { "cache-control": "public, max-age=300" } });
};
