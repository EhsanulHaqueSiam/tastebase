// Trending stats: GitHub stars, stars gained this week, npm weekly downloads. Runs in the Worker's daily cron
// and stores one JSON blob in KV under STATS_KEY. Uses only fetch, so it works in Workers and Node alike.

import type { Library } from "./registry/schema.ts";

export type Stats = Record<string, NonNullable<Library["stats"]>>;
export const STATS_KEY = "stats:v1";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Refreshes the `batch` stalest libraries and keeps the rest as they were. Workers on the free plan allow 50
 * outbound requests per invocation and each library costs two, so an hourly cron with batch 24 cycles through
 * the whole registry every few hours.
 */
export async function refreshStats(libs: Library[], prev: Stats, opts: { githubToken?: string; fetch?: Fetch; batch?: number } = {}): Promise<Stats> {
  const f = opts.fetch ?? fetch;
  const gh: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "tastebase" };
  if (opts.githubToken) gh.authorization = `Bearer ${opts.githubToken}`;
  const json = async <T>(url: string, headers?: Record<string, string>): Promise<T | undefined> => {
    const r = await f(url, { headers }).catch(() => undefined);
    return r?.ok ? ((await r.json()) as T) : undefined;
  };
  const today = new Date().toISOString().slice(0, 10);

  const stalest = [...libs].sort((a, b) => (prev[a.id]?.updatedAt ?? "").localeCompare(prev[b.id]?.updatedAt ?? "")).slice(0, opts.batch ?? libs.length);
  const entries = await Promise.all(
    stalest.map(async (l) => {
      const old = prev[l.id] ?? {};
      const slug = l.repo?.match(/github\.com\/([^/]+\/[^/#?]+)/)?.[1]?.replace(/\.git$/, "");
      const [repo, npm] = await Promise.all([
        slug ? json<{ stargazers_count?: number }>(`https://api.github.com/repos/${slug}`, gh) : undefined,
        l.npm ? json<{ downloads?: number }>(`https://api.npmjs.org/downloads/point/last-week/${l.npm}`) : undefined,
      ]);
      const stars: number | undefined = repo?.stargazers_count ?? old.stars;
      // shortcut: an approximate rolling 7-day gain (decay once per new day, add every gain); exact needs per-day history.
      const gained = stars !== undefined && old.stars !== undefined ? stars - old.stars : 0;
      const starsWeek = Math.max(0, Math.round((old.starsWeek ?? 0) * (old.updatedAt === today ? 1 : 6 / 7) + gained));
      return [l.id, { stars, starsWeek, downloadsWeek: npm?.downloads ?? old.downloadsWeek, updatedAt: today }] as const;
    }),
  );
  return { ...prev, ...Object.fromEntries(entries) };
}

/** Attach stats to libraries for ranking and display. */
export const withStats = (libs: Library[], stats: Stats): Library[] => libs.map((l) => ({ ...l, stats: stats[l.id] ?? l.stats }));
