// Client-safe: paid placements. A sponsor shows first in every card grid and list (category pages, /browse, the home
// shelf, /components, search results) and again after every 8th entry, first in the header search and ⌘K palette,
// first in "Try these", and in the homepage strip; links carry rel="sponsored". With no sponsor running, nothing shows:
// no empty slots. Pages are prerendered, so islands filter by date again at view time (useSponsors): an ended sponsor
// drops out without a deploy.
import { useEffect, useState } from "react";

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

/** Live sponsors for an island, read after hydration so the date check runs at view time, not build time. */
export function useSponsors(place: "grid" | "home" = "grid") {
  const [live, setLive] = useState<Sponsor[]>([]);
  useEffect(() => setLive(liveSponsors(sponsors, Date.now(), place)), [place]);
  return live;
}

export type Slot<T> = { sponsor: Sponsor; key: string } | { item: T; key: string };

/** `items` with sponsors placed first and after every SPONSOR_EVERY items, rotating through them. */
export function withSponsors<T extends { id: string }>(items: readonly T[], live: readonly Sponsor[]): Slot<T>[] {
  if (!live.length || !items.length) return items.map((item) => ({ item, key: item.id }));
  let n = 0;
  const ad = (): Slot<T> => ({ sponsor: live[n % live.length]!, key: `sponsor-${n++}` });
  return [ad(), ...items.flatMap((item, i) => ((i + 1) % SPONSOR_EVERY === 0 ? [{ item, key: item.id }, ad()] : [{ item, key: item.id }]))];
}
