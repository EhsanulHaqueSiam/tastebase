import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { loadAccount } from "../../lib/auth-data.ts";
import { json, providers, sessionUser } from "../../lib/auth.ts";

// GET /api/me -> {providers, user, saved, folders}. The browser asks after a sign-in on this device, or when the sign-in
// sheet opens and needs to know which providers to offer (lib/saved.ts).
export const GET: APIRoute = async ({ request }) => {
  const user = await sessionUser(request);
  if (!user) return json({ providers: providers(), user: null });
  return json({ providers: providers(), user: { name: user.name, image: user.image ?? null }, ...(await loadAccount(env.DB, user.id)) });
};
