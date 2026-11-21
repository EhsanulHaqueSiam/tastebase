import { env } from "cloudflare:workers";
import { mergeSaved, setSaved } from "../../lib/auth-data.ts";
import { json, libId, signedIn } from "../../lib/auth.ts";

// POST /api/saved {lib, on} hearts or unhearts one library; {merge: [ids]} adds the browser's signed-out hearts.
export const POST = signedIn(async (user, b) => {
  if (Array.isArray(b?.merge)) {
    await mergeSaved(env.DB, user.id, [...new Set(b.merge.map(libId).filter((x) => x !== undefined))]);
    return json({ ok: true });
  }
  const lib = libId(b?.lib);
  if (!lib || typeof b?.on !== "boolean") return json({ error: "Send {lib, on} or {merge}." }, 400);
  await setSaved(env.DB, user.id, lib, b.on);
  return json({ ok: true });
});
