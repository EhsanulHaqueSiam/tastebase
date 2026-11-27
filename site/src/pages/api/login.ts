// The terminal's side of `tastebase login` (src/login.ts). No cookies here: the CLI holds a secret or a key, never a session.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { loginId } from "../../../../src/login-code.ts";
import { claimLogin, deleteKey, keyOwner, MAX_KEYS } from "../../lib/auth-data.ts";
import { bearer, json } from "../../lib/auth.ts";

// GET /api/login (Bearer key) -> {name}: whose key this is, so `login --token` can check it before saving it.
export const GET: APIRoute = async ({ request }) => {
  const key = bearer(request);
  const owner = key && (await keyOwner(env.DB, key));
  return owner ? json(owner) : json({ error: "Unknown tastebase agent key." }, 401);
};

// POST /api/login {secret} -> {key} once the user approved the login whose id is sha256(secret), else {pending: true}. The
// CLI asks every 2 seconds for up to 10 minutes: one D1 read each.
export const POST: APIRoute = async ({ request }) => {
  const b: unknown = await request.json().catch(() => null);
  const secret = b && typeof b === "object" && "secret" in b && typeof b.secret === "string" && b.secret.length >= 32 && b.secret.length <= 128 ? b.secret : undefined;
  if (!secret) return json({ error: "Send {secret}." }, 400);
  const made = await claimLogin(env.DB, await loginId(secret));
  if (made === "refused") return json({ error: `This login was already used, or the account has ${MAX_KEYS} keys (sign one out at /account). Log in again.` }, 409);
  return json(made ? { key: made.key } : { pending: true });
};

// DELETE /api/login (Bearer key): `tastebase logout`, that key stops working.
export const DELETE: APIRoute = async ({ request }) => {
  const key = bearer(request);
  if (key) await deleteKey(env.DB, key);
  return json({ ok: true });
};
