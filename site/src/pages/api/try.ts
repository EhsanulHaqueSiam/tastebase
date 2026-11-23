import { env } from "cloudflare:workers";
import { planAnswer } from "../../../../src/mcp.ts";
import { tasteForUser } from "../../lib/auth-data.ts";
import { json, signedIn } from "../../lib/auth.ts";
import { aesthetics, getLibraries } from "../../lib/server.ts";

// POST /api/try {brief, mine} -> {text}: the plan an agent reads for this brief, with the user's taste when `mine` (what
// they hid, hearted and marked off-look, their saved look and framework), or as everyone gets it. One D1 read when mine.
export const POST = signedIn(async (user, b) => {
  const brief = typeof b?.brief === "string" ? b.brief.trim().slice(0, 300) : "";
  if (!brief) return json({ error: "Write a brief first." }, 400);
  const taste = b?.mine ? await tasteForUser(env.DB, user.id) : undefined;
  return json({ text: planAnswer(await getLibraries(), aesthetics, { brief }, taste) });
});
