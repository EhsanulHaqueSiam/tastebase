// Trending on X: which libraries UI builders on X are posting about this week. A daily job (scripts/x-trends.ts) reads
// the recent posts of the accounts below and sends them to /api/x, which credits each post to the libraries it names
// and stores the totals in KV under X_KEY. Keyword search across all of X needs a paid or logged-in session, so the
// signal is this curated circle of library authors and design engineers, not the whole site.

import type { Library } from "./registry/schema.ts";

export const X_KEY = "x:v1";

/** Accounts read each day. Library authors and design engineers whose posts show what UI people are using. */
export const xAccounts = [
  "emilkowalski", "shadcn", "pacocoursey", "mattgperry", "dillionverma", "manuarora", "lochieaxon", "jakubantalik",
  "ibelick", "raunofreiberg", "jh3yy", "steventey", "aidenybai", "rauchg", "greensock", "rive_app",
];

export type XPost = { text: string; url: string; likes: number; created: string };
/** Per library: posts naming it this week, their likes, and the most liked one. */
export type XTrends = { updatedAt: string; libs: Record<string, { posts: number; likes: number; top: string }> };

// Names that are also ordinary words: a post must name these by site, repo or package, never by the word alone.
const COMMON = new Set(["motion", "arc", "rive", "ding", "pele", "sonner", "base ui", "lucide", "swiper", "tiptap"].map((s) => s.toLowerCase()));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const host = (u: string) => new URL(u).host.replace(/^www\./, "");

const word = (s: string) => new RegExp(`(^|[^a-z0-9@/])${escape(s)}($|[^a-z0-9])`);

/** What in a post's text names a library: its site, its repo, its npm package and its name. A name that is a common
 *  word counts only through the site or repo, and its package only inside an install command ("npm i motion"). */
export function xMatchers(l: Library): RegExp[] {
  const name = l.name.toLowerCase();
  const common = COMMON.has(name) || name.length < 4;
  const exact = [l.url && host(l.url) !== "github.com" && host(l.url), l.repo?.replace(/^https:\/\/github\.com\//, "")].filter((x): x is string => !!x);
  const pkg = l.npm?.toLowerCase();
  return [
    ...exact.map((t) => new RegExp(escape(t.toLowerCase()))),
    ...(pkg ? [common ? new RegExp(`(npm i|npm install|pnpm add|yarn add|bun add) ${escape(pkg)}($|[^a-z0-9])`) : word(pkg)] : []),
    ...(common ? [] : [word(name)]),
  ];
}

/** Credits each post from the last 7 days to every library it names; a post counts once per library. */
export function scoreX(posts: XPost[], libs: Library[], now = new Date()): XTrends {
  const since = now.getTime() - 7 * 864e5;
  const seen = new Set<string>();
  const matchers = libs.filter((l) => !l.partOf).map((l) => [l.id, xMatchers(l)] as const);
  const out: XTrends["libs"] = {};
  for (const p of posts) {
    if (seen.has(p.url) || Date.parse(p.created) < since) continue;
    seen.add(p.url);
    const text = p.text.toLowerCase();
    for (const [id, ms] of matchers) {
      if (!ms.some((m) => m.test(text))) continue;
      const s = (out[id] ??= { posts: 0, likes: 0, top: p.url });
      const topLikes = posts.find((q) => q.url === s.top)?.likes ?? 0;
      s.posts++;
      s.likes += p.likes;
      if (p.likes > topLikes) s.top = p.url;
    }
  }
  return { updatedAt: now.toISOString(), libs: out };
}
