import type { APIRoute } from "astro";
import { json, keyTaste } from "../../lib/auth.ts";
import { getLibraries, pickJson } from "../../lib/server.ts";

// GET /api/pick?q=... -> best libraries for one job. With an agent key (Authorization: Bearer), the key owner's taste
// applies, as it does in the MCP `pick` tool.
export const GET: APIRoute = async ({ url, request }) => {
  const q = url.searchParams.get("q")?.slice(0, 200).trim() ?? "";
  const taste = await keyTaste(request);
  if (taste === null) return json({ error: "Unknown tastebase agent key." }, 401);
  const body = q ? pickJson(await getLibraries(), q, taste) : [];
  return taste ? json(body) : Response.json(body, { headers: { "cache-control": "public, max-age=300" } });
};
