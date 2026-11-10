import type { APIRoute } from "astro";
import { resources } from "../../../../src/registry/resources.ts";
import { getLibraries } from "../../lib/server.ts";

// GET /api/libs -> compact lists for the command palette: libraries, then linked design resources.
export const GET: APIRoute = async () => {
  const libs = (await getLibraries()).map((l) => ({ id: l.id, name: l.name, tagline: l.tagline, kind: l.kind, search: l.useFor.join(" ") }));
  const res = resources.map((r) => ({ id: r.id, name: r.name, goodFor: r.goodFor, kind: r.kind, url: r.url }));
  return Response.json({ libs, resources: res }, { headers: { "cache-control": "public, max-age=3600" } });
};
