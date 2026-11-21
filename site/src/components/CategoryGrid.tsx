// A category page's grid: a pricing filter (All, Free, Paid, Freemium, each with its count) over a 4-column card grid,
// with an empty state that offers the way back. Sponsors lead the grid and follow every 8th card (lib/sponsors.ts).
// The filter lives in ?pricing= so a filtered page can be linked.
import { SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import type { Listing, Pricing } from "../lib/categories.ts";
import { liveSponsors, sponsors, withSponsors } from "../lib/sponsors.ts";
import { ListingCard } from "./ListingCard.tsx";

const FILTERS = [["all", "All"], ["free", "Free"], ["paid", "Paid"], ["freemium", "Freemium"]] as const;
type Filter = Pricing | "all";
const isFilter = (v: string | null): v is Filter => FILTERS.some(([id]) => id === v);

export default function CategoryGrid({ items, label }: { items: Listing[]; label: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [live, setLive] = useState<ReturnType<typeof liveSponsors>>([]);
  useEffect(() => setLive(liveSponsors(sponsors)), []); // after hydration: the date check runs at view time, not build time
  useEffect(() => {
    const p = new URLSearchParams(location.search).get("pricing");
    if (isFilter(p)) setFilter(p);
  }, []);
  const choose = (f: Filter) => {
    setFilter(f);
    const u = new URL(location.href);
    if (f === "all") u.searchParams.delete("pricing");
    else u.searchParams.set("pricing", f);
    history.replaceState(history.state, "", u);
  };
  const count = (f: Filter) => (f === "all" ? items.length : items.filter((i) => i.pricing === f).length);
  const shown = filter === "all" ? items : items.filter((i) => i.pricing === filter);
  const name = FILTERS.find(([id]) => id === filter)![1].toLowerCase();

  return (
    <section className="mt-6">
      <p id="pricing-label" className="mb-2 font-mono text-[11px] font-medium tracking-[0.12em] text-fg3 uppercase">Filter by pricing</p>
      <div className="seg max-w-full overflow-x-auto" role="group" aria-labelledby="pricing-label">
        {FILTERS.map(([id, text]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => choose(id)} className="flex items-center gap-1.5">
            {text}
            <span className="text-fg3 tabular-nums">{count(id)}</span>
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="mt-6 grid grid-cols-2 gap-3 pb-10 sm:gap-5 lg:grid-cols-4">
          {withSponsors(shown, live).map((slot, i) => ("sponsor" in slot ? <ListingCard key={slot.key} sponsor={slot.sponsor} where="category-grid" /> : <ListingCard key={slot.key} item={slot.item} eager={i < 4} />))}
        </div>
      ) : (
        <div role="status" className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-xl bg-s1 px-6 py-10 text-center shadow-[inset_0_0_0_1px_var(--color-line)]">
          <span className="grid size-10 place-items-center rounded-full bg-s3 text-fg2"><SearchX size={18} aria-hidden /></span>
          <p className="mt-4 text-[17px] font-semibold">{items.length ? `No ${name} ${label.toLowerCase()} here yet` : `No ${label.toLowerCase()} here yet`}</p>
          <p className="mt-1 max-w-sm text-[13.5px] text-fg2">
            {items.length ? "Nothing in this category matches that pricing. Try another filter or see everything." : "We only list what we have tried. Know a good one? Tell us about it."}
          </p>
          {items.length ? (
            <button type="button" onClick={() => choose("all")} className="press mt-5 rounded-lg bg-fg px-3.5 py-1.5 text-[13.5px] font-semibold text-bg">Show all</button>
          ) : (
            <a href="/contribute" className="press mt-5 rounded-lg bg-fg px-3.5 py-1.5 text-[13.5px] font-semibold text-bg">Suggest one</a>
          )}
        </div>
      )}
    </section>
  );
}
