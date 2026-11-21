// Daily "Trending on X" job: reads each account in src/xtrends.ts through the treg CLI (about $0.00065 an account) and
// posts the raw posts to <site>/api/x, which scores them and stores the result. Runs from the T3 scheduled task on the
// Mac, where `treg` is logged in. --dry prints the ranking instead of posting.
//
//   X_INGEST_TOKEN=... node --experimental-strip-types scripts/x-trends.ts [--dry] [--site https://...]
import { execFileSync } from "node:child_process";
import { libraries } from "../src/registry/index.ts";
import { scoreX, xAccounts, type XPost } from "../src/xtrends.ts";

const arg = (name: string) => process.argv[process.argv.indexOf(name) + 1] ?? "";
const dry = process.argv.includes("--dry");
const site = process.argv.includes("--site") ? arg("--site") : "https://tastebase.ehsanulsiam.workers.dev";

type Row = { text: string; url: string; likes: number; created: string; is_repost: boolean };
const posts: XPost[] = [];
for (const handle of xAccounts) {
  try {
    const out = execFileSync("treg", ["call", "crawl4ai.x.search.posts", "--method", "POST", "--data", JSON.stringify({ query: `from:${handle}` })], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 120_000 });
    const rows = (JSON.parse(out) as { rows?: Row[] }).rows ?? [];
    posts.push(...rows.filter((r) => !r.is_repost).map(({ text, url, likes, created }) => ({ text, url, likes, created })));
    console.error(`@${handle}: ${rows.length} posts`);
  } catch (e) {
    console.error(`@${handle}: failed (${(e as Error).message.split("\n")[0]})`); // one account down must not sink the run
  }
}

if (process.argv.includes("--save")) (await import("node:fs")).writeFileSync(arg("--save"), JSON.stringify(posts));

if (dry) {
  const { libs } = scoreX(posts, libraries);
  for (const [id, s] of Object.entries(libs).sort((a, b) => b[1].likes - a[1].likes)) console.log(`${id}: ${s.posts} posts, ${s.likes} likes, ${s.top}`);
} else {
  const token = process.env.X_INGEST_TOKEN;
  if (!token) throw new Error("X_INGEST_TOKEN is not set");
  const r = await fetch(`${site}/api/x`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ posts }) });
  console.log(`POST ${site}/api/x: ${r.status} ${await r.text()}`);
  if (!r.ok) process.exit(1);
}
