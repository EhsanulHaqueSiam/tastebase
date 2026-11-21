import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { loadAccount } from "../../lib/auth-data.ts";
import { auth, json, sessionUser } from "../../lib/auth.ts";

// GET /api/me -> {enabled, user, saved, folders}. The browser asks only after a sign-in on this device (lib/saved.ts).
export const GET: APIRoute = async ({ request }) => {
  const user = await sessionUser(request);
  if (!user) return json({ enabled: !!auth(), user: null });
  return json({ enabled: true, user: { name: user.name, image: user.image ?? null }, ...(await loadAccount(env.DB, user.id)) });
};
