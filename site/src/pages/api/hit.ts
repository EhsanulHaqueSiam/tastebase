import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// POST /api/hit[?new=1] -> 204. One page view from lib/views.ts; `new` marks a browser's first view in 30 days.
// Nothing about the visitor is written: no path, no IP, no id. Writes are not subrequests.
export const POST: APIRoute = ({ request, url }) => {
  if (request.headers.get("origin") !== url.origin) return new Response(null, { status: 403 });
  env.VIEWS?.writeDataPoint({ doubles: [url.searchParams.has("new") ? 1 : 0] });
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};
