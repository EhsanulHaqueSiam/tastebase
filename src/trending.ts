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

type Sql = { accountId: string; token: string; dataset: string; fetch?: Fetch };

/** One Analytics Engine SQL API call (one subrequest); undefined when it fails, so callers keep their last numbers. */
async function query<T>(o: Sql, sql: string): Promise<T[] | undefined> {
  const r = await (o.fetch ?? fetch)(`https://api.cloudflare.com/client/v4/accounts/${o.accountId}/analytics_engine/sql`, {
    method: "POST",
    headers: { authorization: `Bearer ${o.token}` },
    body: sql,
  }).catch(() => undefined);
  if (!r?.ok) return undefined;
  return ((await r.json()) as { data: T[] }).data;
}

/**
 * How often agents used each library in the last 7 days: MCP `get` calls plus picks offered, as the Worker wrote them
 * to Analytics Engine (one data point per use: blob1 = library id). Nothing about the caller or their query is ever written.
 */
export async function fetchUsage(o: Sql): Promise<Record<string, number> | undefined> {
  const data = await query<{ id: string; n: number | string }>(o, `SELECT blob1 AS id, SUM(_sample_interval) AS n FROM ${o.dataset} WHERE timestamp > NOW() - INTERVAL '7' DAY GROUP BY id FORMAT JSON`);
  return data && Object.fromEntries(data.map((d) => [d.id, Number(d.n)]));
}

/** Site page views and visitors over the last 30 days, shown on the home page and /sponsor. */
export type Views = { views: number; visitors: number };
export const VIEWS_KEY = "views:v1";

/** Totals of /api/hit's data points: one per page shown, double1 = 1 when the browser had not been counted for 30 days. */
export async function fetchViews(o: Sql): Promise<Views | undefined> {
  const data = await query<{ views: number | string | null; visitors: number | string | null }>(o, `SELECT SUM(_sample_interval) AS views, SUM(_sample_interval * double1) AS visitors FROM ${o.dataset} WHERE timestamp > NOW() - INTERVAL '30' DAY FORMAT JSON`);
  return data && { views: Number(data[0]?.views ?? 0), visitors: Number(data[0]?.visitors ?? 0) };
}

/** Writes this week's agent uses into stats; a library with none drops to zero rather than keeping an old count. */
export const withUsage = (stats: Stats, uses: Record<string, number>): Stats =>
  Object.fromEntries([...new Set([...Object.keys(stats), ...Object.keys(uses)])].map((id) => [id, { ...stats[id], agentUses: uses[id] ?? 0 }]));

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
