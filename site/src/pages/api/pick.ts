import type { APIRoute } from "astro";
import { getLibraries, pickJson } from "../../lib/server.ts";

// GET /api/pick?q=... -> best libraries for one job.
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get("q")?.slice(0, 200).trim() ?? "";
  return Response.json(q ? pickJson(await getLibraries(), q) : [], { headers: { "cache-control": "public, max-age=300" } });
};
