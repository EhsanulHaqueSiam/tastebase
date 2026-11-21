// Client-safe: paid placements. A sponsor shows first in category grids and again after every 8th card, first in the
// header search and ⌘K palette, first in "Try these", and in the homepage strip; links carry rel="sponsored". Pages are
// prerendered, so islands filter by date again at view time: an ended sponsor drops out without a deploy.
// Adding one: an entry below with a 16:9 image in site/public/sponsors/. Never in agent answers (MCP, CLI, llms.txt).

export type Sponsor = {
  id: string;
  name: string;
  description: string;
  /** /sponsors/<file>, 16:9 like a card screenshot. */
  image: string;
  url: string;
  /** Higher shows first. */
  priority: number;
  /** ISO dates; the placement runs from `starts` until `ends`. */
  starts: string;
  ends: string;
  /** Only in the homepage strip, never in grids, search or "Try these". */
  homepageOnly?: boolean;
  active: boolean;
  /** Shown only under `pnpm dev`, to check placements without a real sponsor. */
  development?: true;
};

export const sponsors: Sponsor[] = [
  {
    id: "placeholder",
    name: "Your product here",
    description: "Reach people and their coding agents while they choose UI libraries.",
    image: "/sponsors/placeholder.svg",
    url: "/sponsor",
    priority: 0,
    starts: "2026-01-01",
    ends: "2099-01-01",
    active: true,
    development: true,
  },
];

const dev = !!import.meta.env?.DEV;

/** Every 8th card (two rows of four) is a sponsor, after the one that leads the grid. */
export const SPONSOR_EVERY = 8;

/** Sponsors running at `now`, best first. `place` = "grid" drops homepage-only ones. */
export const liveSponsors = (list: readonly Sponsor[], now = Date.now(), place: "grid" | "home" = "grid") =>
  list
    .filter((s) => s.active && (dev || !s.development) && Date.parse(s.starts) <= now && now < Date.parse(s.ends) && (place === "home" || !s.homepageOnly))
    .sort((a, b) => b.priority - a.priority);

export type Slot<T> = { sponsor: Sponsor; key: string } | { item: T; key: string };

/** `items` with sponsors placed first and after every SPONSOR_EVERY items, rotating through them. */
export function withSponsors<T extends { id: string }>(items: readonly T[], live: readonly Sponsor[]): Slot<T>[] {
  if (!live.length || !items.length) return items.map((item) => ({ item, key: item.id }));
  let n = 0;
  const ad = (): Slot<T> => ({ sponsor: live[n % live.length]!, key: `sponsor-${n++}` });
  return [ad(), ...items.flatMap((item, i) => ((i + 1) % SPONSOR_EVERY === 0 ? [{ item, key: item.id }, ad()] : [{ item, key: item.id }]))];
}
