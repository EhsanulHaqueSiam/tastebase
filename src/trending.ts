// Trending stats: GitHub stars, stars gained this week, npm weekly downloads. Runs in the Worker's daily cron
// and stores one JSON blob in KV under STATS_KEY. Uses only fetch, so it works in Workers and Node alike.

import type { Library } from "./registry/schema.ts";

export type Stats = Record<string, NonNullable<Library["stats"]>>;
export const STATS_KEY = "stats:v1";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Refreshes the `batch` stalest libraries and keeps the rest as they were. Workers on the free plan allow 50
 * outbound requests per invocation; a batch of 24 costs at most 24 GitHub calls + its scoped npm packages + one
 * bulk npm call, so an hourly cron cycles through the whole registry every few hours.
 */
export async function refreshStats(libs: Library[], prev: Stats, opts: { githubToken?: string; fetch?: Fetch; batch?: number } = {}): Promise<Stats> {
  const f = opts.fetch ?? fetch;
  const gh: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "tastebase" };
  if (opts.githubToken) gh.authorization = `Bearer ${opts.githubToken}`;
  // One retry after a short pause on 429: npm throttles bursts.
  const json = async <T>(url: string, headers?: Record<string, string>, retry = true): Promise<T | undefined> => {
    const r = await f(url, { headers }).catch(() => undefined);
    if (r?.status === 429 && retry) return new Promise((ok) => setTimeout(() => ok(json<T>(url, headers, false)), 1500));
    return r?.ok ? ((await r.json()) as T) : undefined;
  };
  const today = new Date().toISOString().slice(0, 10);

  const stalest = libs.filter((l) => !l.partOf).sort((a, b) => (prev[a.id]?.updatedAt ?? "").localeCompare(prev[b.id]?.updatedAt ?? "")).slice(0, opts.batch ?? libs.length);

  // npm: one bulk request covers every unscoped package; scoped ones (@x/y) are not supported in bulk.
  const unscoped = stalest.flatMap((l) => (l.npm && !l.npm.startsWith("@") ? [l.npm] : []));
  type Point = { downloads?: number };
  const raw = unscoped.length ? await json<Record<string, Point | null> | Point>(`https://api.npmjs.org/downloads/point/last-week/${unscoped.join(",")}`) : undefined;
  // With a single name npm answers in the single-package shape instead of a map.
  const bulk: Record<string, Point | null> | undefined = raw && "downloads" in raw ? { [unscoped[0]!]: raw as Point } : (raw as Record<string, Point | null> | undefined);
  const downloads = async (pkg?: string) =>
    !pkg ? undefined : pkg.startsWith("@") ? (await json<Point>(`https://api.npmjs.org/downloads/point/last-week/${pkg}`))?.downloads : bulk?.[pkg]?.downloads;

  const entries = await pool(stalest, 6, async (l) => {
    const old = prev[l.id] ?? {};
    const slug = l.repo?.match(/github\.com\/([^/]+\/[^/#?]+)/)?.[1]?.replace(/\.git$/, "");
    const [repo, dl] = await Promise.all([slug ? json<{ stargazers_count?: number }>(`https://api.github.com/repos/${slug}`, gh) : undefined, downloads(l.npm)]);
    const stars: number | undefined = repo?.stargazers_count ?? old.stars;
    // shortcut: an approximate rolling 7-day gain (decay once per new day, add every gain); exact needs per-day history.
    const gained = stars !== undefined && old.stars !== undefined ? stars - old.stars : 0;
    const starsWeek = Math.max(0, Math.round((old.starsWeek ?? 0) * (old.updatedAt === today ? 1 : 6 / 7) + gained));
    return [l.id, { stars, starsWeek, downloadsWeek: dl ?? old.downloadsWeek, updatedAt: today }] as const;
  });
  return { ...prev, ...Object.fromEntries(entries) };
}

/** Attach stats to libraries for ranking and display. */
export const withStats = (libs: Library[], stats: Stats): Library[] => libs.map((l) => ({ ...l, stats: stats[l.id] ?? l.stats }));

/** Maps with at most `n` calls in flight. */
async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }));
  return out;
}
