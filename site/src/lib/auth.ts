// Server-only: better-auth on D1, GitHub sign-in, a session cookie. /api/auth/* hands requests to it; the account
// routes (/api/me, /api/saved, /api/folders) only read the session. Built once per isolate, on first use.
import type { APIContext, APIRoute } from "astro";
import { betterAuth } from "better-auth";
import { env } from "cloudflare:workers";
import { libraries } from "../../../src/registry/index.ts";

const make = () =>
  betterAuth({
    database: env.DB,
    // Every stage is a workers.dev host (prod, pr-<n>) or a laptop; the callback URL is built from the request's host.
    // The OAuth app accepts http://127.0.0.1 on any port, so local sign-in works whatever port `pnpm dev` lands on.
    baseURL: { allowedHosts: ["*.workers.dev", "localhost:*", "127.0.0.1:*"] },
    secret: env.BETTER_AUTH_SECRET,
    // More providers (X, Google) go here, with their keys in alchemy.run.ts authEnv.
    socialProviders: { github: { clientId: env.AUTH_GITHUB_ID!, clientSecret: env.AUTH_GITHUB_SECRET! } },
    telemetry: { enabled: false },
  });

let instance: ReturnType<typeof make> | undefined;
/** Undefined when this stage has no auth keys (CI, previews): everything account-shaped answers signed out. */
export const auth = () => (env.AUTH_GITHUB_ID ? (instance ??= make()) : undefined);

export async function sessionUser(request: Request) {
  return (await auth()?.api.getSession({ headers: request.headers }))?.user;
}

const known = new Set(libraries.map((l) => l.id));
/** A registry id from untrusted input, or undefined. Hearts and folders hold nothing else. */
export const libId = (v: unknown) => (typeof v === "string" && known.has(v) ? v : undefined);

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
