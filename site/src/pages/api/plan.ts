import type { APIRoute } from "astro";
import { json, keyTaste } from "../../lib/auth.ts";
import { getLibraries, planJson } from "../../lib/server.ts";

// GET /api/plan?brief=... -> the same stack the MCP `plan` tool returns, as JSON for the site. With an agent key
// (Authorization: Bearer), the key owner's taste applies, as it does in `plan`.
export const GET: APIRoute = async ({ url, request }) => {
  const brief = url.searchParams.get("brief")?.slice(0, 500) ?? "";
  const taste = await keyTaste(request);
  if (taste === null) return json({ error: "Unknown tastebase agent key." }, 401);
  const body = planJson(await getLibraries(), brief, undefined, taste);
  return taste ? json(body) : Response.json(body, { headers: { "cache-control": "public, max-age=300" } });
};
