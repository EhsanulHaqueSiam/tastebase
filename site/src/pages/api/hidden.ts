import { env } from "cloudflare:workers";
import { setHidden } from "../../lib/auth-data.ts";
import { itemId, json, signedIn } from "../../lib/auth.ts";

// POST /api/hidden {item, on} hides or unhides one library or resource from the user's agent (their agent key, /mcp).
export const POST = signedIn(async (user, b) => {
  const item = itemId(b?.item);
  if (!item || typeof b?.on !== "boolean") return json({ error: "Send {item, on}." }, 400);
  await setHidden(env.DB, user.id, item, b.on);
  return json({ ok: true });
});
