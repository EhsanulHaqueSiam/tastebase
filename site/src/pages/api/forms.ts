// /api/forms. GET -> the Turnstile sitekey (pages are prerendered, so islands ask for it). POST -> one form submission:
// validate, check Turnstile, then count it against RATE_LIMIT per IP per hour in KV, then email the admin. Nothing is
// stored beyond that hourly counter. Subrequests: one siteverify, one KV read, one KV write, one email.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { mailFor, RATE_LIMIT, rateKey, request, schemas } from "../../lib/forms.ts";

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export const GET: APIRoute = () => json({ sitekey: env.TURNSTILE_SITEKEY, ready: !!env.FORMS_TO });

export const POST: APIRoute = async ({ request: req }) => {
  if (!env.FORMS_TO) return json({ error: "Forms aren't set up on this copy of tastebase yet." }, 503);
  const parsed = request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400);
  const { form, token, fields: raw } = parsed.data;
  const fields = schemas[form].safeParse(raw);
  if (!fields.success) return json({ error: "Check the highlighted fields", fields: Object.fromEntries(fields.error.issues.map((i) => [i.path.join("."), i.message])) }, 400);

  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }) })
    .then((r) => r.json() as Promise<{ success?: boolean }>)
    .catch(() => ({ success: false }));
  if (!check.success) return json({ error: "The human check failed. Try it again." }, 403);

  const key = rateKey(ip);
  const count = Number((await env.STATS.get(key)) ?? 0);
  if (count >= RATE_LIMIT) return json({ error: "That's a lot of messages in one hour. Try again later." }, 429);
  await env.STATS.put(key, String(count + 1), { expirationTtl: 3600 });

  const { subject, text } = mailFor(form, fields.data as Record<string, string>);
  const replyTo = "email" in fields.data && fields.data.email ? fields.data.email : undefined;
  try {
    await env.MAIL.send({ from: { email: env.FORMS_FROM, name: "tastebase" }, to: env.FORMS_TO, replyTo, subject, text });
  } catch (e) {
    console.error("forms: send failed", (e as Error).message);
    return json({ error: "We couldn't send that. Try again in a minute." }, 502);
  }
  return json({ ok: true });
};
