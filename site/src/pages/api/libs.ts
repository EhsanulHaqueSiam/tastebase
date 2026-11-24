import type { APIRoute } from "astro";
import { resources } from "../../../../src/registry/resources.ts";
import { listedResources } from "../../lib/listings.ts";
import { aesthetics, getLibraries } from "../../lib/server.ts";
import { withUtm } from "../../lib/utm.ts";

const pageOf = new Map(listedResources.map(({ r, category }) => [r.id, `/${category}/${r.id}`]));

// GET /api/libs -> compact lists for the command palette: libraries, looks, then design resources. A recommended resource
// opens its page here; a reviewed one, which has no page, opens its site.
export const GET: APIRoute = async () => {
  const libs = (await getLibraries()).map((l) => ({ id: l.id, name: l.name, tagline: l.tagline, kind: l.kind, search: l.useFor.join(" ") }));
  const res = resources.map((r) => ({ id: r.id, name: r.name, goodFor: r.goodFor, kind: r.kind, href: pageOf.get(r.id) ?? withUtm(r.url, "palette") }));
  const looks = aesthetics.map((a) => ({ id: a.id, name: a.name, summary: a.summary, accent: a.swatch.accent, search: a.signals.join(" ") }));
  return Response.json({ libs, looks, resources: res }, { headers: { "cache-control": "public, max-age=3600" } });
};
