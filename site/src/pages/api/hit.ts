import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// POST /api/hit?n=<views>[&new=1] -> 204. A tab's page views since its last send (lib/views.ts), one data point per
// send: double1 marks a browser's first view in 30 days, double2 is views - 1 so older one-view points still sum right
// (fetchViews). Nothing about the visitor is written: no path, no IP, no id. Writes are not subrequests.
export const POST: APIRoute = ({ request, url }) => {
  if (request.headers.get("origin") !== url.origin) return new Response(null, { status: 403 });
  const n = Math.min(200, Math.max(1, Math.floor(Number(url.searchParams.get("n")) || 1)));
  env.VIEWS?.writeDataPoint({ doubles: [url.searchParams.has("new") ? 1 : 0, n - 1] });
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};
