// The card every category grid, "Recently added" and "Try these" share: a 16:9 screenshot, the name and two lines.
// Hover lifts it 4px and eases the screenshot to 1.04 (after Design Index's cards).
import type { Listing } from "../lib/categories.ts";

export function ListingCard({ item, eager = false, compact = false }: { item: Listing; eager?: boolean; compact?: boolean }) {
  const external = /^https?:/.test(item.href);
  return (
    <a href={item.href} {...(external && { target: "_blank", rel: "noopener" })} className="group relative flex flex-col overflow-hidden rounded-xl bg-s1 shadow-[0_0_0_1px_var(--color-line),0_4px_14px_var(--drop)] transition-[translate,box-shadow] duration-200 ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-[0_0_0_1px_var(--color-line2),0_18px_40px_-12px_var(--drop-lift)]">
      <div className="aspect-video overflow-hidden bg-s2">
        <img
          src={item.image}
          alt=""
          width={1200}
          height={675}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-cover object-top transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04]"
        />
      </div>
      <div className={`flex flex-1 flex-col gap-1 ${compact ? "p-3" : "p-3 sm:gap-1.5 sm:p-4"}`}>
        <h3 className={`leading-snug font-semibold tracking-[-0.01em] ${compact ? "text-[14px] sm:text-[15px]" : "text-[14px] sm:text-[17px]"}`}>{item.name}</h3>
        <p className="line-clamp-2 text-[12px] leading-4 text-fg2 sm:text-[13.5px] sm:leading-5">{item.description}</p>
      </div>
    </a>
  );
}
