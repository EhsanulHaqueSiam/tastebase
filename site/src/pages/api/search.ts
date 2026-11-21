import type { APIRoute } from "astro";
import { jobFramework, pick } from "../../../../src/engine.ts";
import { libraryListing } from "../../lib/listings.ts";
import { getLibraries } from "../../lib/server.ts";

// GET /api/search?q=... -> {relevant, similar}: the home page's result grid (Hero.tsx), as cards. The engine's picks for
// the query, split at half the top score: what clearly fits the job, then what fits it less. There is no keyword match
// count to split on, as Design Index has; the score already says how well each one fits.
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get("q")?.slice(0, 200).trim() ?? "";
  const hits = q ? pick(await getLibraries(), q, { limit: 30, framework: jobFramework(q) }) : [];
  const bar = (hits[0]?.score ?? 0) / 2;
  const cards = (keep: (score: number) => boolean) => hits.filter((s) => keep(s.score)).map((s) => libraryListing(s.lib));
  return Response.json({ relevant: cards((s) => s >= bar), similar: cards((s) => s < bar) }, { headers: { "cache-control": "public, max-age=300" } });
};
