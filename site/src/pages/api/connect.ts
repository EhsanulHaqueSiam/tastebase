import { env } from "cloudflare:workers";
import { idFrom } from "../../../../src/login-code.ts";
import { approveLogin, MAX_KEYS } from "../../lib/auth-data.ts";
import { json, keyName, signedIn } from "../../lib/auth.ts";

// POST /api/connect {id, name} -> {account}: the signed-in user approves the terminal's login `id` (`tastebase login`), which then
// claims a key named `name` from POST /api/login.
export const POST = signedIn(async (user, b) => {
  const id = idFrom(b?.id);
  if (!id) return json({ error: "This link is not one tastebase login opens." }, 400);
  const r = await approveLogin(env.DB, user.id, id, keyName(b?.name) ?? "Terminal");
  if (r === "ok") return json({ account: user.name });
  return json({ error: r === "full" ? `You have ${MAX_KEYS} agent keys. Sign one out in your account, then approve again.` : "This login is already approved." }, 409);
});
