import { env } from "cloudflare:workers";
import { frameworks, type Framework } from "../../../../src/registry/schema.ts";
import { setPrefs } from "../../lib/auth-data.ts";
import { json, signedIn } from "../../lib/auth.ts";
import { aesthetics } from "../../lib/server.ts";

const isFramework = (v: unknown): v is Framework => frameworks.includes(v as Framework);

// POST /api/prefs {look, framework}: the user's defaults for their agent, each a known id or null (detect, as for everyone).
export const POST = signedIn(async (user, b) => {
  const look = b?.look === null ? null : aesthetics.find((a) => a.id === b?.look)?.id;
  const framework = b?.framework === null ? null : isFramework(b?.framework) ? b.framework : undefined;
  if (look === undefined || framework === undefined) return json({ error: "Send {look, framework}: a known id or null each." }, 400);
  await setPrefs(env.DB, user.id, { look, framework });
  return json({ ok: true });
});
