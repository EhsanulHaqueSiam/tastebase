// Build-time: libraries and recommended resources as one kind of card (Listing), sorted into the site's categories.
import designeer from "../../../src/registry/designeer.json" with { type: "json" };
import { resources, type Resource } from "../../../src/registry/resources.ts";
import type { Library } from "../../../src/registry/schema.ts";
import { categories, type Category, type Listing, type Pricing } from "./categories.ts";
import { shot } from "./kinds.ts";
import { libraries } from "./server.ts";

/** What designeer.xyz lists for an entry: its page there, its category, palette and whether its preview clip is here. */
export const fromDesigneer = (id: string) => (designeer as Record<string, { page: string; category: string; palette: string[]; video?: true }>)[id];
// Palette and preview clip, when designeer has them.
const extras = (id: string) => {
  const d = fromDesigneer(id);
  return { ...(d?.palette.length && { palette: d.palette }), ...(d?.video && { video: `/videos/${id}.mp4` }) };
};

const categoryOfResource = (r: Resource) => categories.find((c) => c.resources.some((k) => k === r.kind))?.slug;
const categoryOfLibrary = (l: Library) => categories.find((c: Category) => c.kinds?.includes(l.kind))?.slug ?? "browse";

/** A resource's cost line read as a pricing filter: free, paid, or free with a paid tier. */
export function resourcePricing({ free, cost }: Pick<Resource, "free" | "cost">): Pricing {
  if (free) return /\$|€|\bpro\b|paid|plus|lifetime|credits?\b|plan\b/i.test(cost) ? "freemium" : "free";
  return /free/i.test(cost) ? "freemium" : "paid";
}

export const libraryListing = (l: Library): Listing => ({
  id: l.id,
  name: l.name,
  description: l.tagline,
  url: l.url,
  demo: l.demo,
  href: `/browse/${l.id}`,
  image: shot(l.id),
  pricing: l.paid ? "freemium" : "free",
  addedAt: l.addedAt,
  category: categoryOfLibrary(l),
  ...extras(l.id),
});

/** Resources tastebase recommends ("reviewed" ones are listed elsewhere as not picked) that belong to a category. */
export const listedResources = resources.flatMap((r) => {
  const category = categoryOfResource(r);
  return category ? [{ r, category }] : [];
});

export const resourceListing = (r: Resource, category: string): Listing => ({
  id: r.id,
  name: r.name,
  // goodFor often ends in a setup command ("...: npx skills add x"); a card shows only the description before it. A
  // site that is down says why instead.
  description: r.down && r.caveat ? r.caveat.replace(/^Down on [\d-]+: /, `Site down since ${r.down}: `) : r.goodFor.split(/[.:] (?=(?:Free|Skills|npx|claude)\b)/)[0]!,
  url: r.url,
  href: `/${category}/${r.id}`,
  image: shot(r.id),
  pricing: resourcePricing(r),
  addedAt: r.addedAt,
  category,
  ...extras(r.id),
  ...(r.down && { down: r.down }),
});

export const allListings: Listing[] = [...libraries.map(libraryListing), ...listedResources.map(({ r, category }) => resourceListing(r, category))];

/** A category's cards: its libraries, then its resources, each in registry order; sites found down go last. */
export const listingsIn = (slug: string) => allListings.filter((l) => l.category === slug).sort((a, b) => Number(!!a.down) - Number(!!b.down));

/** The newest entries: dated ones by date, then undated ones latest-in-the-registry first. */
export function recentListings(n: number) {
  const order = new Map(allListings.map((l, i) => [l, i]));
  return [...allListings].sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? "") || order.get(b)! - order.get(a)!).slice(0, n);
}

const byId = new Map(allListings.map((l) => [l.id, l]));

/** "Try these" on a detail page: the ids it names first (a library's alternatives and pairings), then its category
 *  neighbours, starting after it so each page shows a different few. */
export function relatedTo(item: Listing, prefer: string[] = [], n = 4) {
  const peers = allListings.filter((l) => l.category === item.category);
  const at = peers.findIndex((l) => l.id === item.id);
  const around = [...peers.slice(at + 1), ...peers.slice(0, Math.max(at, 0))];
  const picks = [...prefer.flatMap((id) => byId.get(id) ?? []), ...around].filter((l) => l.id !== item.id);
  return [...new Map(picks.map((l) => [l.id, l])).values()].slice(0, n);
}
