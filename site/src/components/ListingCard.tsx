// The card every category grid, "Recently added" and "Try these" share: a 16:9 screenshot, the name and two lines.
// Hover lifts it 4px and eases the screenshot to 1.04 (after Design Index's cards). A sponsor gets the same card with a
// "Sponsored" tag, linking straight to its site with rel="sponsored".
import type { Listing } from "../lib/categories.ts";
import type { Sponsor } from "../lib/sponsors.ts";
import { withUtm } from "../lib/utm.ts";

type Props = { eager?: boolean; compact?: boolean; where?: string } & ({ item: Listing; sponsor?: never } | { sponsor: Sponsor; item?: never });

export function ListingCard({ item, sponsor, eager = false, compact = false, where = "card" }: Props) {
  const c = sponsor ? { href: withUtm(sponsor.url, where), name: sponsor.name, description: sponsor.description, image: sponsor.image } : item;
  return (
    <a
      href={c.href}
      {...(sponsor && { target: "_blank", rel: "sponsored noopener" })}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-s1 shadow-[0_0_0_1px_var(--color-line),0_4px_14px_var(--drop)] transition-[translate,box-shadow] duration-200 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-[0_0_0_1px_var(--color-line2),0_18px_40px_-12px_var(--drop-lift)]"
    >
      {sponsor && <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-bg/80 px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.1em] uppercase backdrop-blur">Sponsored</span>}
      <div className="aspect-video overflow-hidden bg-s2">
        <img
          src={c.image}
          alt=""
          width={1200}
          height={675}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-cover object-top transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04]"
        />
      </div>
      <div className={`flex flex-1 flex-col gap-1 ${compact ? "p-3" : "p-3 sm:gap-1.5 sm:p-4"}`}>
        <h3 className={`leading-snug font-semibold tracking-[-0.01em] ${compact ? "text-[14px] sm:text-[15px]" : "text-[14px] sm:text-[17px]"}`}>{c.name}</h3>
        <p className="line-clamp-2 text-[12px] leading-4 text-fg2 sm:text-[13.5px] sm:leading-5">{c.description}</p>
      </div>
    </a>
  );
}
