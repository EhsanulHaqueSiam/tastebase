// Server-only: better-auth on D1, sign-in with GitHub, Google or X (whichever this stage has keys for), a session cookie. /api/auth/* hands requests to it; the account
// routes (/api/me, /api/saved, /api/folders) only read the session. Built once per isolate, on first use.
import type { APIContext, APIRoute } from "astro";
import { betterAuth } from "better-auth";
import { env } from "cloudflare:workers";
import { libraries } from "../../../src/registry/index.ts";
import { resources } from "../../../src/registry/resources.ts";
import { partOf } from "../../../src/taste.ts";

/** The providers this stage has keys for (alchemy.run.ts authEnv), in the order the sign-in sheet lists them. */
const socialProviders = () => ({
  ...(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET ? { github: { clientId: env.AUTH_GITHUB_ID, clientSecret: env.AUTH_GITHUB_SECRET } } : {}),
  ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET ? { google: { clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET } } : {}),
  // better-auth calls X "twitter": its callback is /api/auth/callback/twitter. X may share no email; better-auth then
  // stores a placeholder, which nothing here reads.
  ...(env.AUTH_X_ID && env.AUTH_X_SECRET ? { twitter: { clientId: env.AUTH_X_ID, clientSecret: env.AUTH_X_SECRET } } : {}),
});
export type Provider = keyof ReturnType<typeof socialProviders>;
/** What /api/me tells the sign-in sheet to offer. */
export const providers = () => Object.keys(socialProviders()) as Provider[];

const make = () =>
  betterAuth({
    database: env.DB,
    // Every stage is a workers.dev host (prod, pr-<n>) or a laptop; the callback URL is built from the request's host.
    // The OAuth app accepts http://127.0.0.1 on any port, so local sign-in works whatever port `pnpm dev` lands on.
    baseURL: { allowedHosts: ["*.workers.dev", "localhost:*", "127.0.0.1:*"] },
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: socialProviders(),
    // Under `pnpm dev` only (false in every build): `pnpm flows` signs up a throwaway user, since OAuth needs a person.
    emailAndPassword: { enabled: import.meta.env.DEV },
    telemetry: { enabled: false },
  });

let instance: ReturnType<typeof make> | undefined;
/** Undefined when this stage has no auth keys (CI checks): everything account-shaped answers signed out. */
export const auth = () => (env.BETTER_AUTH_SECRET && providers().length ? (instance ??= make()) : undefined);

export async function sessionUser(request: Request) {
  return (await auth()?.api.getSession({ headers: request.headers }))?.user;
}

const known = new Set(libraries.map((l) => l.id));
/** A registry id from untrusted input, or undefined. Hearts and folders hold nothing else. */
export const libId = (v: unknown) => (typeof v === "string" && known.has(v) ? v : undefined);
const items = new Set([...known, ...resources.map((r) => r.id)]);
/** A library or resource id from untrusted input, or undefined: what an editor may pick. */
export const itemId = (v: unknown) => (typeof v === "string" && items.has(v) ? v : undefined);
/** An item id, or one part of a kit (library/part), from untrusted input: what a user may hide from their agent. */
export const hideId = (v: unknown) => itemId(v) ?? (typeof v === "string" && partOf(libraries, v) ? v : undefined);

/** A folder name from untrusted input: trimmed, 1 to 60 characters. */
export const folderName = (v: unknown) => {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return s && s.length <= 60 ? s : undefined;
};

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "private, no-store" } });

type User = NonNullable<Awaited<ReturnType<typeof sessionUser>>>;

/** An account write: only from this site's own pages, only signed in. The handler gets the user and the parsed body. */
export const signedIn =
  (h: (user: User, b: Record<string, unknown> | null, ctx: APIContext) => Promise<Response>): APIRoute =>
  async (ctx) => {
    // JSON bodies already need CORS; the origin check also covers simple cross-site requests.
    if (ctx.request.headers.get("origin") !== ctx.url.origin) return json({ error: "Cross-origin request." }, 403);
    const user = await sessionUser(ctx.request);
    if (!user) return json({ error: "Sign in first." }, 401);
    return h(user, ctx.request.method === "DELETE" ? null : await body(ctx.request), ctx);
  };

/** Body as an object, or null when it is not a JSON object. */
const body = async (request: Request): Promise<Record<string, unknown> | null> => {
  const v: unknown = await request.json().catch(() => null);
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
};
