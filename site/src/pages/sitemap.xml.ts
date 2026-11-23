// /sitemap.xml: every prerendered page, so search engines find each library page. Prerendered.
import type { APIRoute } from "astro";
import { comparisons, roundups } from "../lib/articles.ts";
import { categories } from "../lib/categories.ts";
import { listedResources } from "../lib/listings.ts";
import { aesthetics, libraries } from "../lib/server.ts";
import { ORIGIN } from "../lib/site.ts";

export const prerender = true;

export const GET: APIRoute = () => {
  const paths = ["", "/browse", "/atlas", "/looks", "/integrations", "/components", "/contribute", "/match", "/submit", "/feedback", "/sponsor", "/about", "/terms", "/best", "/alternatives", ...[...roundups, ...comparisons].map((a) => a.path), ...categories.map((c) => `/${c.slug}`), ...libraries.map((l) => `/browse/${l.id}`), ...aesthetics.map((a) => `/looks/${a.id}`), ...listedResources.map(({ r, category }) => `/${category}/${r.id}`)];
  const urls = paths.map((p) => `  <url><loc>${ORIGIN}${p}</loc></url>`).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
};
