// The card every category grid, "Recently added", "Try these", search results and article share: a 16:9 screenshot,
// the name and two lines. Hover lifts it 4px and eases the screenshot to 1.04 (after Design Index's cards). A sponsor
// gets the same card with a brighter ring, ↗ and "Sponsored" beside the name (the screenshot stays clean), linking
// straight to its site with rel="sponsored". The title's link is stretched over the card, so `pills` (other articles
// a library is in) can be links of their own, not nested anchors.
// A screenshot that fails to load is marked by Base.astro's error listener and shows "no preview" instead. `actions`
// (islands only: they need hydrating) adds heart, folder and hide over the screenshot (CardActions.tsx).
import { ArrowRightLeft, ArrowUpRight, Gift, ListOrdered } from "lucide-react";
import { lazy, Suspense } from "react";
import type { Pill } from "../lib/articles.ts";
import type { Listing } from "../lib/categories.ts";
import type { Sponsor } from "../lib/sponsors.ts";
import { thumb } from "../lib/kinds.ts";
import { withUtm } from "../lib/utm.ts";

const CardActions = lazy(() => import("./CardActions.tsx"));

const PILL_ICON: Record<Pill["icon"], typeof Gift> = { alternatives: ArrowRightLeft, free: Gift, best: ListOrdered };

type Props = { eager?: boolean; late?: boolean; compact?: boolean; where?: string; pills?: Pill[]; actions?: boolean } & ({ item: Listing; sponsor?: never } | { sponsor: Sponsor; item?: never });

export function ListingCard({ item, sponsor, eager = false, late = false, compact = false, where = "card", pills = [], actions = false }: Props) {
  const c = sponsor ? { href: withUtm(sponsor.url, where), name: sponsor.name, description: sponsor.description, image: sponsor.image } : item;
  return (
    <div className={`group relative flex h-full flex-col overflow-hidden rounded-xl bg-s1 ${sponsor ? "shadow-[0_0_0_1px_var(--color-line2),0_4px_14px_var(--drop)]" : "shadow-[0_0_0_1px_var(--color-line),0_4px_14px_var(--drop)]"} transition-[translate,box-shadow] duration-200 ease-[var(--ease-out)] has-[h3_a:focus-visible]:outline-2 has-[h3_a:focus-visible]:outline-blue hover:-translate-y-1 hover:shadow-[0_0_0_1px_var(--color-line2),0_18px_40px_-12px_var(--drop-lift)]`}>
      {item && actions && (
        <Suspense fallback={null}>
          <CardActions id={item.id} name={item.name} href={item.href} />
        </Suspense>
      )}
      <div className="relative aspect-video overflow-hidden bg-s2 transition-opacity group-has-[[data-hidden]]:opacity-35">
        {/* `late`: the screenshot waits for the page's load (Base.astro fills data-late), static pages included. */}
        <img
          src={late ? undefined : thumb(c.image)}
          data-late={late ? thumb(c.image) : undefined}
          alt=""
          width={1200}
          height={675}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
          data-fallback
          className="peer size-full object-cover object-top transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04] data-failed:invisible"
        />
        <span aria-hidden="true" className="absolute inset-0 hidden place-items-center text-[13px] text-fg3 peer-data-failed:grid">no preview</span>
      </div>
      <div className={`flex flex-1 flex-col gap-1 transition-opacity group-has-[[data-hidden]]:opacity-35 ${compact ? "p-3" : "p-3 sm:gap-1.5 sm:p-4"}`}>
        <h3 className={`${sponsor ? "flex items-baseline gap-2" : ""} leading-snug font-semibold tracking-[-0.01em] ${compact ? "text-[14px] sm:text-[15px]" : "text-[14px] sm:text-[17px]"}`}>
          <a href={c.href} {...(sponsor ? { target: "_blank", rel: "sponsored noopener" } : { "data-sound": "navigate" })} className="outline-none after:absolute after:inset-0 after:content-['']">
            {c.name}
            {sponsor && <ArrowUpRight size={14} className="ml-0.5 inline align-[-1px] text-fg3" aria-hidden />}
          </a>
          {sponsor && <span className="ml-auto shrink-0 font-mono text-[10px] font-normal tracking-[0.08em] text-fg3 uppercase">Sponsored</span>}
        </h3>
        <p className="line-clamp-2 text-[12px] leading-4 text-fg2 sm:text-[13.5px] sm:leading-5">{c.description}</p>
        {pills.length > 0 && (
          <ul className="relative z-10 mt-auto flex flex-wrap gap-1.5 pt-2" aria-label={`Articles with ${c.name}`}>
            {pills.map((p) => {
              const Icon = PILL_ICON[p.icon];
              return (
                <li key={p.href}>
                  <a href={p.href} data-sound="navigate" className="press inline-flex items-center gap-1.5 rounded-full bg-s2 px-2.5 py-1 text-[12px] font-medium text-fg2 shadow-[inset_0_0_0_1px_var(--color-line2)] hover:text-fg">
                    <Icon size={13} aria-hidden />
                    {p.label}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
