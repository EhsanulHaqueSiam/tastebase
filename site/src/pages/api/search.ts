import type { APIRoute } from "astro";
import { detectLooks, jobFramework, negations, pick } from "../../../../src/engine.ts";
import { libraryListing, listedResources, resourceListing } from "../../lib/listings.ts";
import { wordShare } from "../../lib/search.ts";
import { aesthetics, getLibraries } from "../../lib/server.ts";

// GET /api/search?q=... -> {relevant, similar, looks}: the home page's result grid (Hero.tsx), as cards, and the ⌘K
// palette's Best fit group. The engine's picks for the query, split at half the top score: what clearly fits the job,
// then what fits it less. There is no keyword match count to split on, as Design Index has; the score already says how
// well each one fits. When the engine finds no library for the job, `similar` holds what names the query's words
// instead (libraries, then design resources), so a query outside every job still finds something. `looks`: ids of
// the looks the query names.
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get("q")?.slice(0, 200).trim() ?? "";
  const libs = await getLibraries();
  const hits = q ? pick(libs, q, { limit: 30, framework: jobFramework(q) }) : [];
  const bar = (hits[0]?.score ?? 0) / 2;
  const cards = (keep: (score: number) => boolean) => hits.filter((s) => keep(s.score)).map((s) => libraryListing(s.lib));
  const named = () =>
    [
      ...libs.map((l) => [wordShare(q, `${l.name} ${l.tagline} ${l.useFor.join(" ")}`), libraryListing(l)] as const),
      ...listedResources.map(({ r, category }) => [wordShare(q, `${r.name} ${r.goodFor}`), resourceListing(r, category)] as const),
    ]
      .filter(([s]) => s > 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 12)
      .map(([, card]) => card);
  const looks = q ? detectLooks(aesthetics, negations(q).want).slice(0, 2).map((a) => a.id) : [];
  return Response.json({ relevant: cards((s) => s >= bar), similar: q && !hits.length ? named() : cards((s) => s < bar), looks }, { headers: { "cache-control": "public, max-age=300" } });
};
