import type { APIRoute } from "astro";
import { getLibraries } from "../../lib/server.ts";

// GET /api/libs -> compact list for the command palette.
export const GET: APIRoute = async () => {
  const libs = (await getLibraries()).map((l) => ({ id: l.id, name: l.name, tagline: l.tagline, kind: l.kind, search: l.useFor.join(" ") }));
  return Response.json(libs, { headers: { "cache-control": "public, max-age=3600" } });
};
