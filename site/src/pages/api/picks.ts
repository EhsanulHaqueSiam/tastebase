import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAdmin, listPicks, setPick } from "../../lib/auth-data.ts";
import { itemId, json, signedIn } from "../../lib/auth.ts";

// GET /api/picks -> {picks: [{id, reason}]}, newest first: one D1 read, cached by the browser for two minutes (the
// Worker cannot cache at the edge on workers.dev). Islands read it through lib/picks.ts.
export const GET: APIRoute = async () => Response.json({ picks: await listPicks(env.DB) }, { headers: { "cache-control": "public, max-age=120" } });

/** A one-line reason from untrusted input: whitespace folded, 1 to 160 characters. */
const reason = (v: unknown) => {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return s && s.length <= 160 ? s : undefined;
};

// POST /api/picks {item, on, reason} picks or unpicks a library or resource; admins only (ADMIN_EMAILS).
export const POST = signedIn(async (user, b) => {
  if (!isAdmin(user, env.ADMIN_EMAILS)) return json({ error: "Only editors can pick." }, 403);
  const item = itemId(b?.item);
  const why = reason(b?.reason);
  if (!item || typeof b?.on !== "boolean" || (b.on && !why)) return json({ error: "Send {item, on, reason}: a one-line reason, up to 160 characters." }, 400);
  await setPick(env.DB, item, b.on ? why! : null);
  return json({ ok: true });
});
