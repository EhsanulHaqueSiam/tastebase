import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { loadAccount } from "../../lib/auth-data.ts";
import { json, providers, sessionUser } from "../../lib/auth.ts";
import { allListings } from "../../lib/listings.ts";

const byId = new Map(allListings.map((l) => [l.id, l]));

// GET /api/me -> {providers, user, saved, folders, hidden, key}. The browser asks after a sign-in on this device, or when
// the sign-in sheet opens and needs to know which providers to offer (lib/saved.ts). Hidden items come with the name
// and page the account sheet lists them by.
export const GET: APIRoute = async ({ request }) => {
  const user = await sessionUser(request);
  if (!user) return json({ providers: providers(), user: null });
  const account = await loadAccount(env.DB, user.id);
  const hidden = account.hidden.map((id) => ({ id, name: byId.get(id)?.name ?? id, href: byId.get(id)?.href ?? "/" }));
  return json({ providers: providers(), user: { name: user.name, image: user.image ?? null }, ...account, hidden });
};
