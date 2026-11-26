// Requests to list a site (site_request in D1). GET -> {mine, open?}: the user's own requests, and for an admin the queue
// (asked when the Requests panel opens, never on every page like /api/me). POST {url, note}: file one, capped per user in
// D1. PATCH {url, status, libId | reason}: an admin settles every request for that link.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createRequest, isAdmin, MAX_OPEN_REQUESTS, MAX_REQUESTS_A_DAY, myRequests, openRequests, settleRequests, siteUrl } from "../../lib/auth-data.ts";
import { itemId, json, sessionUser, signedIn } from "../../lib/auth.ts";

export const GET: APIRoute = async ({ request }) => {
  const user = await sessionUser(request);
  if (!user) return json({ error: "Sign in first." }, 401);
  const admin = isAdmin(user, env.ADMIN_EMAILS);
  const [mine, open] = await Promise.all([myRequests(env.DB, user.id), admin ? openRequests(env.DB) : undefined]);
  return json({ mine, ...(open && { open }) });
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export const POST = signedIn(async (user, b) => {
  const at = siteUrl(b?.url);
  if (!at) return json({ error: "Enter a link that starts with https://", field: "url" }, 400);
  const r = await createRequest(env.DB, user.id, at, text(b?.note, 500));
  if ("duplicate" in r) return json({ error: "You sent this already.", request: r.duplicate }, 409);
  if ("limit" in r) return json({ error: `That's the limit for now: ${MAX_OPEN_REQUESTS} waiting, ${MAX_REQUESTS_A_DAY} a day.` }, 429);
  // The admin hears about it too, as /submit always did. Best effort: the request is saved either way.
  if (env.FORMS_TO) await env.MAIL.send({ from: { email: env.FORMS_FROM, name: "tastebase" }, to: env.FORMS_TO, subject: `[tastebase] Request: ${at.host}`.slice(0, 200), text: `${at.url}\n\n${r.ok.note}\n\n(from ${user.name}, in the account's Requests)` }).catch((e: Error) => console.error("requests: mail failed", e.message));
  return json({ request: r.ok });
});

export const PATCH = signedIn(async (user, b) => {
  if (!isAdmin(user, env.ADMIN_EMAILS)) return json({ error: "Only an admin can do that." }, 403);
  const at = siteUrl(b?.url);
  if (!at) return json({ error: "Unknown link." }, 400);
  if (b?.status === "added") {
    const libId = itemId(b.libId);
    if (!libId) return json({ error: "Pick the registry id it was added as.", field: "libId" }, 400);
    return json({ settled: await settleRequests(env.DB, at.url, { status: "added", libId }) });
  }
  if (b?.status === "declined") return json({ settled: await settleRequests(env.DB, at.url, { status: "declined", reason: text(b.reason, 200) }) });
  return json({ error: "Status is added or declined." }, 400);
});
