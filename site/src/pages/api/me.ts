import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { isAdmin, loadAccount } from "../../lib/auth-data.ts";
import { json, providers, sessionUser } from "../../lib/auth.ts";
import { allListings } from "../../lib/listings.ts";
import { libraries } from "../../../../src/registry/index.ts";
import { partOf } from "../../../../src/taste.ts";

const byId = new Map(allListings.map((l) => [l.id, l]));

// GET /api/me -> {providers, user, saved, folders, hidden, key, admin}. `admin`: may set editor's picks (ADMIN_EMAILS). The browser asks after a sign-in on this device, or when
// the sign-in sheet opens and needs to know which providers to offer (lib/saved.ts). Hidden items come with the name
// and page the account sheet lists them by.
export const GET: APIRoute = async ({ request }) => {
  const user = await sessionUser(request);
  if (!user) return json({ providers: providers(), user: null });
  const account = await loadAccount(env.DB, user.id);
  const hidden = account.hidden.map((id) => {
    // One part of a kit, hidden through the agent's taste tool: listed by the kit's name and page.
    const p = partOf(libraries, id);
    const l = byId.get(p?.lib.id ?? id);
    return { id, name: p ? `${p.lib.name}: ${p.part}` : (l?.name ?? id), href: l?.href ?? "/" };
  });
  return json({ providers: providers(), user: { name: user.name, image: user.image ?? null }, ...account, hidden, admin: isAdmin(user, env.ADMIN_EMAILS) });
};
