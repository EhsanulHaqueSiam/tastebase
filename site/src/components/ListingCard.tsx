// The card every category grid, "Recently added", "Try these", search results and article share: a 16:9 screenshot,
// the name and two lines. Hover lifts it 4px and eases the screenshot to 1.04 (after Design Index's cards). A sponsor
// gets the same card with a "Sponsored" tag, linking straight to its site with rel="sponsored". The title's link is
// stretched over the card, so `pills` (other articles a library is in) can be links of their own, not nested anchors.
// A screenshot that fails to load is marked by Base.astro's error listener and shows "no preview" instead.
import { ArrowRightLeft, Gift, ListOrdered } from "lucide-react";
import type { Pill } from "../lib/articles.ts";
import type { Listing } from "../lib/categories.ts";
import type { Sponsor } from "../lib/sponsors.ts";
import { withUtm } from "../lib/utm.ts";

const PILL_ICON: Record<Pill["icon"], typeof Gift> = { alternatives: ArrowRightLeft, free: Gift, best: ListOrdered };

type Props = { eager?: boolean; late?: boolean; compact?: boolean; where?: string; pills?: Pill[] } & ({ item: Listing; sponsor?: never } | { sponsor: Sponsor; item?: never });

export function ListingCard({ item, sponsor, eager = false, late = false, compact = false, where = "card", pills = [] }: Props) {
  const c = sponsor ? { href: withUtm(sponsor.url, where), name: sponsor.name, description: sponsor.description, image: sponsor.image } : item;
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-s1 shadow-[0_0_0_1px_var(--color-line),0_4px_14px_var(--drop)] transition-[translate,box-shadow] duration-200 ease-[var(--ease-out)] has-[h3_a:focus-visible]:outline-2 has-[h3_a:focus-visible]:outline-blue hover:-translate-y-1 hover:shadow-[0_0_0_1px_var(--color-line2),0_18px_40px_-12px_var(--drop-lift)]">
      {sponsor && <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-bg/80 px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.1em] uppercase backdrop-blur">Sponsored</span>}
      <div className="relative aspect-video overflow-hidden bg-s2">
        {!late && <img
          src={c.image}
          alt=""
          width={1200}
          height={675}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          data-fallback
          className="peer size-full object-cover object-top transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04] data-failed:invisible"
        />}
        <span aria-hidden="true" className="absolute inset-0 hidden place-items-center text-[13px] text-fg3 peer-data-failed:grid">no preview</span>
      </div>
      <div className={`flex flex-1 flex-col gap-1 ${compact ? "p-3" : "p-3 sm:gap-1.5 sm:p-4"}`}>
        <h3 className={`leading-snug font-semibold tracking-[-0.01em] ${compact ? "text-[14px] sm:text-[15px]" : "text-[14px] sm:text-[17px]"}`}>
          <a href={c.href} {...(sponsor ? { target: "_blank", rel: "sponsored noopener" } : { "data-cuelume-navigate": "" })} className="outline-none after:absolute after:inset-0 after:content-['']">
            {c.name}
          </a>
        </h3>
        <p className="line-clamp-2 text-[12px] leading-4 text-fg2 sm:text-[13.5px] sm:leading-5">{c.description}</p>
        {pills.length > 0 && (
          <ul className="relative z-10 mt-auto flex flex-wrap gap-1.5 pt-2" aria-label={`Articles with ${c.name}`}>
            {pills.map((p) => {
              const Icon = PILL_ICON[p.icon];
              return (
                <li key={p.href}>
                  <a href={p.href} data-cuelume-navigate className="press inline-flex items-center gap-1.5 rounded-full bg-s2 px-2.5 py-1 text-[12px] font-medium text-fg2 shadow-[inset_0_0_0_1px_var(--color-line2)] hover:text-fg">
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
