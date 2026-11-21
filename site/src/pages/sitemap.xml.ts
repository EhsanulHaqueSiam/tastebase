// /sitemap.xml: every prerendered page, so search engines find each library page. Prerendered.
import type { APIRoute } from "astro";
import { libraries } from "../lib/server.ts";

export const prerender = true;

const ORIGIN = "https://tastebase.ehsanulsiam.workers.dev";

export const GET: APIRoute = () => {
  const paths = ["", "/browse", "/atlas", "/looks", "/integrations", "/components", "/contribute", "/match", ...libraries.map((l) => `/browse/${l.id}`)];
  const urls = paths.map((p) => `  <url><loc>${ORIGIN}${p}</loc></url>`).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
};
