// Refreshes src/registry/stats.json: GitHub stars, stars gained since the last run, npm weekly downloads.
// Run daily (see .github/workflows/trending.yml). Uses GITHUB_TOKEN when present to avoid rate limits.
import { readFileSync, writeFileSync } from "node:fs";
import { libraries } from "../src/registry/index.ts";
import type { Library } from "../src/registry/schema.ts";

const file = "src/registry/stats.json";
const prev: Record<string, NonNullable<Library["stats"]>> = JSON.parse(readFileSync(file, "utf8"));
const headers: Record<string, string> = { accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const json = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, init);
  return r.ok ? r.json() : undefined;
};

const next: typeof prev = {};
for (const l of libraries) {
  const old = prev[l.id] ?? {};
  const slug = l.repo?.match(/github\.com\/([^/]+\/[^/#?]+)/)?.[1]?.replace(/\.git$/, "");
  const gh = slug ? await json(`https://api.github.com/repos/${slug}`, { headers }) : undefined;
  const npm = l.npm ? await json(`https://api.npmjs.org/downloads/point/last-week/${l.npm}`) : undefined;
  const stars: number | undefined = gh?.stargazers_count ?? old.stars;
  // Stars gained since the last run; the daily job keeps a rolling 7-day figure by decaying the old one.
  const gained = stars !== undefined && old.stars !== undefined ? stars - old.stars : 0;
  next[l.id] = {
    stars,
    starsWeek: Math.max(0, Math.round((old.starsWeek ?? 0) * (6 / 7) + gained)),
    downloadsWeek: npm?.downloads ?? old.downloadsWeek,
    updatedAt: new Date().toISOString().slice(0, 10),
  };
}
writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
console.log(`updated ${Object.keys(next).length} libraries`);
