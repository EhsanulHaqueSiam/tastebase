// A detail page's actions, twice over (after Design Index): outlined Visit and Share under the title, and a floating
// pill at the bottom with the sidebar toggle, search, a solid Visit, Share and the theme toggle. The pill's sidebar toggle hides the
// desktop rail so the live site gets the room, and opens the More sheet on phones; search opens the ⌘K palette.
import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { haptic } from "../lib/haptics.ts";
import { useIconHover } from "../lib/nav.ts";
import { sharePage, withUtm } from "../lib/utm.ts";
import { ArrowUpRightIcon } from "./icons/arrow-up-right.tsx";
import { PanelLeftOpenIcon } from "./icons/panel-left-open.tsx";
import { SearchIcon } from "./icons/search.tsx";
import ThemeToggle from "./ThemeToggle.tsx";

type Props = { name: string; url: string; sponsored?: boolean };

const visitRel = (sponsored?: boolean) => (sponsored ? "sponsored noopener" : "noopener");

/** Share state for a button: "Copied" for a moment after the clipboard fallback. */
function useShare(name: string, where: string) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    haptic("light");
    if ((await sharePage(name, where)) === "copied") setCopied(true), setTimeout(() => setCopied(false), 1500);
  };
  return { copied, share };
}

export function DetailActions({ name, url, sponsored }: Props) {
  const { copied, share } = useShare(name, "detail-page");
  const cls = "press inline-flex h-10 items-center gap-2 rounded-[14px] px-4 text-[15px] font-semibold shadow-[inset_0_0_0_1px_var(--color-line2)] hover:bg-s2";
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <a href={withUtm(url, "detail-page")} target="_blank" rel={visitRel(sponsored)} className={cls}>
        <svg viewBox="0 0 24 24" className="size-[15px]" fill="currentColor" aria-hidden><path d="M5 3.5v17l15-8.5z" /></svg>
        visit
      </a>
      <button type="button" onClick={share} className={cls}>
        {copied ? <Check size={15} aria-hidden /> : <Share2 size={15} aria-hidden />}
        <span aria-live="polite">{copied ? "copied" : "share"}</span>
      </button>
    </div>
  );
}

export function DetailPill({ name, url, sponsored }: Props) {
  const { copied, share } = useShare(name, "floating-pill");
  const side = useIconHover();
  const find = useIconHover();
  const visit = useIconHover();
  const toggleSide = () => {
    haptic("selection");
    if (matchMedia("(min-width: 1024px)").matches) {
      const root = document.documentElement;
      root.toggleAttribute("data-rail-hidden");
    } else window.dispatchEvent(new Event("tb:more"));
  };
  const ctl = "press grid size-11 shrink-0 place-items-center rounded-[16px] text-fg transition-colors hover:bg-s3";
  return (
    <div className="fixed bottom-[calc(60px+12px+env(safe-area-inset-bottom))] left-1/2 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-1 rounded-[22px] bg-s2 p-1.5 shadow-[0_0_0_1px_var(--color-line2),0_12px_32px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.06)] lg:bottom-6">
      <button type="button" aria-label="Toggle sidebar" onClick={toggleSide} {...side.on} className={ctl}>
        <PanelLeftOpenIcon ref={side.ref} size={21} className="grid place-items-center" />
      </button>
      <button type="button" aria-label="Search" onClick={() => window.dispatchEvent(new CustomEvent("tb:search", { detail: "" }))} {...find.on} className={ctl}>
        <SearchIcon ref={find.ref} size={20} className="grid place-items-center" />
      </button>
      <a href={withUtm(url, "floating-pill")} target="_blank" rel={visitRel(sponsored)} {...visit.on} className="press flex h-11 shrink-0 items-center gap-1.5 rounded-[16px] bg-fg pr-3.5 pl-4.5 text-[15px] font-medium text-bg hover:opacity-90">
        Visit <ArrowUpRightIcon ref={visit.ref} size={18} className="grid place-items-center" />
      </a>
      <button type="button" onClick={share} className="press flex h-11 shrink-0 items-center gap-2 rounded-[16px] px-4 text-[15px] font-medium transition-colors hover:bg-s3">
        {copied ? <Check size={18} aria-hidden /> : <Share2 size={18} aria-hidden />}
        <span aria-live="polite">{copied ? "Copied" : "Share"}</span>
      </button>
      <ThemeToggle size={21} className="size-11 shrink-0 rounded-[16px] text-fg transition-colors hover:bg-s3" />
    </div>
  );
}
