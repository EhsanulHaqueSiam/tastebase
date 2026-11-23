import { env } from "cloudflare:workers";
import { deleteAgentKey, makeAgentKey } from "../../lib/auth-data.ts";
import { json, signedIn } from "../../lib/auth.ts";

// POST /api/agent-key -> {key}: a new agent key, replacing the old one. The only time the key itself is sent.
export const POST = signedIn(async (user) => json({ key: await makeAgentKey(env.DB, user.id) }));

// DELETE /api/agent-key: the key stops working and none replaces it.
export const DELETE = signedIn(async (user) => (await deleteAgentKey(env.DB, user.id), json({ ok: true })));
