import { env } from "cloudflare:workers";
import { deleteAgentKey, makeAgentKey, MAX_KEYS } from "../../lib/auth-data.ts";
import { json, keyName, signedIn } from "../../lib/auth.ts";

// POST /api/agent-key {name?} -> {key, entry}: a new agent key next to the others. The only time the key itself is sent.
export const POST = signedIn(async (user, b) => {
  const made = await makeAgentKey(env.DB, user.id, keyName(b?.name) ?? "Key");
  return made ? json(made) : json({ error: `You have ${MAX_KEYS} keys. Sign one out first.` }, 409);
});

// DELETE /api/agent-key?id=...: that key stops working; the others keep working.
export const DELETE = signedIn(async (user, _, { url }) => (await deleteAgentKey(env.DB, user.id, url.searchParams.get("id") ?? ""), json({ ok: true })));
