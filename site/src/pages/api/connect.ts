import { env } from "cloudflare:workers";
import { codeFrom } from "../../../../src/login-code.ts";
import { approveLogin } from "../../lib/auth-data.ts";
import { json, keyName, signedIn } from "../../lib/auth.ts";

// POST /api/connect {code, name}: the signed-in user approves the terminal showing `code` (`tastebase login`), which then
// claims a key named `name` from POST /api/login.
export const POST = signedIn(async (user, b) => {
  const code = codeFrom(b?.code);
  if (!code) return json({ error: "That code is not one tastebase login prints." }, 400);
  return (await approveLogin(env.DB, user.id, code, keyName(b?.name) ?? "Terminal")) ? json({ ok: true }) : json({ error: "This code is already approved." }, 409);
});
