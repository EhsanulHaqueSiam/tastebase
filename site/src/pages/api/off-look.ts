import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { offLookCounts, setOffLook } from "../../lib/auth-data.ts";
import { hideId, json, signedIn } from "../../lib/auth.ts";
import { aesthetics } from "../../lib/server.ts";

// GET /api/off-look -> [{item, look, users}]: how many users' agents marked a library or part wrong for a look (the
// `taste` tool), most first. Counts only, never who. tune-picks reads it to fix a look's picks and a library's tags.
export const GET: APIRoute = async () =>
  Response.json(await offLookCounts(env.DB), { headers: { "cache-control": "public, max-age=3600" } });

// POST /api/off-look {item, look, on}: leaves one library or kit part out under one look for this user, or brings it back.
export const POST = signedIn(async (user, b) => {
  const item = hideId(b?.item);
  const look = aesthetics.find((a) => a.id === b?.look)?.id;
  if (!item || !look || typeof b?.on !== "boolean") return json({ error: "Send {item, look, on}." }, 400);
  await setOffLook(env.DB, user.id, item, look, b.on);
  return json({ ok: true });
});
