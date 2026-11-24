// /browse: every library, filtered by job (with live counts), price, framework and words; grid or list; saved ones and
// editor's picks (searching "editor" or "editor's pick" finds those too). Words match names, taglines, jobs, looks and
// use cases, so a sentence works ("a date picker for my app"): see wordShare in lib/search.ts.
// A running sponsor leads the results and follows every 8th (lib/sponsors.ts). On desktop a library opens in a sheet
// over the results (DetailSheet.tsx), so the job list stays in reach; while it is open the list folds to its icons
// (html[data-sheet]), each naming its job and count on hover, like the nav rail.
// No max width: the job list sits against the nav rail at any size (folded beside a sheet too), and wide screens get
// more columns instead of bigger cards.
import { ArrowUpRight, ChevronDown, Heart, LayoutGrid, List, Search, Star } from "lucide-react";
import { memo, startTransition, useDeferredValue, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { frameworks, kinds, type Framework, type Kind } from "../../../src/registry/schema.ts";
import { stems } from "../../../src/words.ts";
import { kindMeta } from "../lib/kinds.ts";
import { useLoaded } from "../lib/loaded.ts";
import { useEditorPicks } from "../lib/picks.ts";
import { useSaved } from "../lib/saved.ts";
import { wordShare } from "../lib/search.ts";
import { useSponsors, withSponsors, type Sponsor } from "../lib/sponsors.ts";
import { withUtm } from "../lib/utm.ts";
import type { ShelfLib } from "../lib/server.ts";
import { useStats } from "../lib/stats.ts";
import DetailSheet from "./DetailSheet.tsx";
import { CopyButton } from "./fx.tsx";
import { FW, KindIcon, LibCard, SaveButton, SponsorLibCard, SORTS, sortBy, statBadge, type Sort } from "./LibCard.tsx";
import { LibMark } from "./LibMark.tsx";
import { Seg } from "./Seg.tsx";

declare global {
  /** Set by Base.astro on Back and Forward: the scroll the history entry `index` was left at. */
  interface Window { tbBack?: { index?: number; y?: number } }
}

type Job = Kind | "all" | "saved" | "editors";
const PRICES = [["any", "Any"], ["free", "Free"], ["paid", "Paid"]] as const;
const PAGE = 48; // cards per step: enough to fill a large screen several times over
type Price = (typeof PRICES)[number][0];
const isJob = (v: string | null): v is Job => v === "all" || v === "saved" || v === "editors" || kinds.some((k) => k === v);

export default function Directory({ libs }: { libs: (ShelfLib & { uses: string })[] }) {
  const stats = useStats();
  const saved = useSaved();
  const picks = useEditorPicks();
  const [job, setJob] = useState<Job>("all");
  const [price, setPrice] = useState<Price>("any");
  const [fw, setFw] = useState<Framework>();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("picks");
  const [view, setView] = useState<"grid" | "list">("grid");
  // Cards mount PAGE at a time as the end comes near: all ~200 at once cost ~300ms of hydration on a slow phone.
  // The server renders six; the rest mount after hydration. Screenshots after the first card wait for the page to load,
  // so they do not share a slow phone's bandwidth with the first card's (the page's largest paint).
  const [limit, setLimit] = useState(6);
  const loaded = useLoaded();
  const live = useSponsors();
  // A transition: React renders the extra cards in slices, so a slow phone's main thread stays free during the swap.
  // Back to a scrolled directory: the router restores the scroll while only six cards exist, so the page is short, the
  // restore stops at its bottom and the end-of-list loader then mounts every card under the reader, who lands at the
  // footer. Mount every card first, then put the scroll back.
  const restore = useRef<number>(undefined);
  useEffect(() => {
    const at = history.state as { index?: number; scrollY?: number } | null;
    const y = (window.tbBack?.index === at?.index ? window.tbBack?.y : at?.scrollY) ?? 0;
    if (y < innerHeight) return startTransition(() => setLimit((n) => Math.max(n, PAGE)));
    restore.current = y;
    // A transition, so it commits after the sponsor slots (useSponsors sets them in this same pass, urgently): slots
    // arriving after the restore would push the reader's cards down.
    startTransition(() => setLimit(libs.length + 8)); // every card, plus the sponsor slots
  }, []);
  // Before paint in that commit, so the footer the short page was restored to never shows.
  useLayoutEffect(() => {
    if (restore.current === undefined || limit < libs.length) return;
    document.documentElement.style.removeProperty("--tb-hold"); // set by Base.astro for the router's restore
    scrollTo({ top: restore.current, behavior: "instant" });
    restore.current = undefined;
  }, [limit]);
  const more = useRef<HTMLDivElement>(null);
  const results = useRef<HTMLElement>(null);

  // Every filter lives in the URL (?job=motion&q=toast&price=free&fw=vue&sort=stars&view=list), so Back from another
  // page, a reload and a shared link all come back to the same results. Defaults are left out.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const j = p.get("job");
    const pr = PRICES.find(([id]) => id === p.get("price"))?.[0];
    const f = frameworks.find((x) => x === p.get("fw"));
    const so = SORTS.find(([id]) => id === p.get("sort"))?.[0];
    if (isJob(j)) setJob(j);
    setQ(p.get("q") ?? "");
    if (pr) setPrice(pr);
    if (f) setFw(f);
    if (so) setSort(so);
    if (p.get("view") === "list") setView("list");
  }, []);
  useEffect(() => {
    const u = new URL(location.href);
    const put = (k: string, v: string | undefined, def: string) => (v && v !== def ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    put("job", job, "all");
    put("q", q.trim(), "");
    put("price", price, "any");
    put("fw", fw, "");
    put("sort", sort, "picks");
    put("view", view, "grid");
    if (u.href !== location.href) history.replaceState(history.state, "", u);
  }, [job, q, price, fw, sort, view]);
  // A new job starts at the top of its results, not partway down the old list.
  const pickJob = (j: Job) => (setJob(j), scrollY > 0 && scrollTo({ top: 0, behavior: "instant" }));

  // Price, framework and words narrow everything; the job picks within that, so job counts follow the other filters.
  // A query of only stop words ("ui", "react") narrows nothing: the framework filter covers the latter.
  const narrow = (p: Price, f: Framework | undefined, text: string) =>
    libs
      .filter((l) => p === "any" || l.paid === (p === "paid"))
      .filter((l) => !f || l.frameworks.includes(f))
      .filter((l) => !stems(text).length || wordShare(text, `${l.name} ${l.tagline} ${kindMeta[l.kind].label} ${l.aesthetic.join(" ")} ${l.uses}${picks.has(l.id) ? " editor's pick editors picks" : ""}`, true) > 0);
  const inJob = (j: Job) => (l: ShelfLib) => (j === "all" ? true : j === "saved" ? saved.includes(l.id) : j === "editors" ? picks.has(l.id) : l.kind === j);
  const base = narrow(price, fw, q);
  const count = (j: Job) => base.filter(inJob(j)).length;
  // The cards follow deferred filters: a tap repaints the controls and counts at once, and the grid re-renders after,
  // in slices a newer tap can interrupt (a phone's filter tap was one ~170ms frame).
  const [dJob, dPrice, dFw, dQ, dSort] = [useDeferredValue(job), useDeferredValue(price), useDeferredValue(fw), useDeferredValue(q), useDeferredValue(sort)];
  const list = narrow(dPrice, dFw, dQ).filter(inJob(dJob)).sort(sortBy(dSort, stats));
  // Keyed cards are reused across filter changes, so switching jobs mounts at most PAGE new ones.
  const visible = list.slice(0, limit);
  const hasMore = list.length > limit;
  useEffect(() => {
    if (!hasMore || !more.current) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && startTransition(() => setLimit((n) => n + PAGE)), { rootMargin: "1200px" });
    io.observe(more.current);
    return () => io.disconnect();
  }, [hasMore, limit]);
  const jobs = [...kinds].sort((a, b) => count(b) - count(a));
  const title = job === "all" ? "All libraries" : job === "saved" ? "Saved" : job === "editors" ? "Editor's picks" : kindMeta[job].label;
  const filtered = price !== "any" || fw || q.trim();
  const reset = () => (setPrice("any"), setFw(undefined), setQ(""));

  return (
    <div className="grid grid-cols-1 pt-14 lg:grid-cols-[236px_minmax(0,1fr)] lg:[[data-sheet]_&]:grid-cols-[56px_minmax(0,1fr)]">
      <aside aria-label="Jobs" className="flex gap-1 overflow-x-auto border-b border-line px-4 py-3 [scrollbar-width:none] lg:sticky lg:top-14 lg:h-[calc(100svh-4rem)] lg:flex-col lg:gap-px lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-2.5 lg:py-4 lg:[[data-sheet]_&]:items-center lg:[[data-sheet]_&]:overflow-visible lg:[[data-sheet]_&]:z-[55] lg:[[data-sheet]_&]:px-1.5">
        <Row on={job === "saved"} onClick={() => pickJob("saved")} n={count("saved")} icon={<span data-anim="pop" className="grid place-items-center text-pink"><Heart size={15} aria-hidden /></span>}>Saved</Row>
        <Row on={job === "all"} onClick={() => pickJob("all")} n={count("all")} icon={<span data-anim="pop" className="grid place-items-center"><LayoutGrid size={15} aria-hidden /></span>}>All libraries</Row>
        {(picks.size > 0 || job === "editors") && (
          <Row on={job === "editors"} onClick={() => pickJob("editors")} n={count("editors")} icon={<span data-anim="pop" className="grid place-items-center text-amber"><Star size={15} aria-hidden /></span>}>Editor's picks</Row>
        )}
        {/* Folded, it keeps its space: a press on a job unfolds the list before the release, and moved rows would turn
            the click into a press on the row above. */}
        <h2 className="hidden px-2 pt-4 pb-1.5 font-mono text-[11.5px] text-fg3 lg:block lg:[[data-sheet]_&]:invisible">Job</h2>
        {jobs.map((k) => (
          <Row key={k} on={job === k} onClick={() => pickJob(k)} n={count(k)} icon={<KindIcon kind={k} />}>{kindMeta[k].label}</Row>
        ))}
        <h2 className="hidden px-2 pt-4 pb-1.5 font-mono text-[11.5px] text-fg3 lg:block lg:[[data-sheet]_&]:hidden">Price</h2>
        {/* A wrapper, because .seg's own display would beat Tailwind's `hidden`. */}
        <div className="mx-1 hidden lg:block lg:[[data-sheet]_&]:hidden">
          <Seg label="Price">
            {PRICES.map(([id, label]) => <button key={id} type="button" aria-pressed={price === id} onClick={() => setPrice(id)}>{label}</button>)}
          </Seg>
        </div>
      </aside>

      <section ref={results} data-sheet-host aria-labelledby="dir-title" className="min-h-(--tb-hold) min-w-0 px-4 pt-5 pb-24 lg:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 id="dir-title" className="text-[18px] font-semibold tracking-[-0.02em]">
            {title} <span className="ml-1 font-mono text-[13px] font-medium text-fg3 tabular-nums">{count(job)}</span>
          </h1>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 max-sm:basis-full max-sm:justify-start">
            <label className="flex h-[34px] min-w-0 flex-[1_1_220px] items-center gap-2 rounded-[9px] bg-s2 px-2.5 shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)] max-sm:basis-full">
              <Search size={14} className="shrink-0 text-fg3" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, job or look…"
                aria-label="Search libraries"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg3 [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            <Select label="Framework" value={fw ?? ""} shown={fw ? FW[fw] : "Any"} onChange={(v) => setFw(frameworks.find((f) => f === v))} options={[["", "Any"], ...frameworks.map((f) => [f, FW[f]] as const)]} />
            <Select label="Price" className="lg:hidden" value={price} shown={PRICES.find(([id]) => id === price)![1]} onChange={(v) => setPrice(PRICES.find(([id]) => id === v)?.[0] ?? "any")} options={PRICES} />
            {/* Scrolls inside its row on narrow screens: five sorts are wider than a 390px phone. */}
            <div className="max-w-full min-w-0 overflow-x-auto [scrollbar-width:none]">
              <Seg label="Sort">
                {SORTS.map(([id, label]) => <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>)}
              </Seg>
            </div>
            <Seg label="View">
              <button type="button" aria-pressed={view === "grid"} aria-label="Grid" onClick={() => setView("grid")}><LayoutGrid size={14} /></button>
              <button type="button" aria-pressed={view === "list"} aria-label="List" onClick={() => setView("list")}><List size={14} /></button>
            </Seg>
          </div>
        </div>

        <div className="mt-3 flex justify-between gap-2 text-[12.5px] text-fg3">
          <span aria-live="polite">
            {list.length} {list.length === 1 ? "library" : "libraries"}
            {price !== "any" && (price === "free" ? ", free" : ", with a paid tier")}
            {fw && ` on ${FW[fw]}`}
            {q.trim() && ` matching “${q.trim()}”`}, {SORTS.find(([id]) => id === sort)![2]}
          </span>
          <button type="button" onClick={reset} disabled={!filtered} className="text-fg2 transition-colors hover:text-fg disabled:opacity-40 disabled:hover:text-fg2">Reset</button>
        </div>

        {view === "grid" ? (
          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[112.5rem]:grid-cols-4 min-[144rem]:grid-cols-5">
            {withSponsors(visible, live).map((slot, i) => <div key={slot.key}>{"sponsor" in slot ? <SponsorLibCard sponsor={slot.sponsor} where="browse-grid" /> : <LibCard lib={slot.item} badge={statBadge(sort, stats?.[slot.item.id])} eager={i === 0} late={!loaded && i > 0} />}</div>)}
          </div>
        ) : (
          <ul className="mt-2.5 overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_var(--color-line)]">
            {withSponsors(visible, live).map((slot) => ("sponsor" in slot ? <SponsorRow key={slot.key} sponsor={slot.sponsor} /> : <ListRow key={slot.key} lib={slot.item} stat={statBadge(sort, stats?.[slot.item.id])} />))}
          </ul>
        )}
        {hasMore && <div ref={more} aria-hidden className="h-px" />}

        {!list.length && (
          <p className="py-16 text-center text-fg3">
            {job === "saved" && !saved.length ? "Nothing saved yet. Tap the heart on any library to keep it here." : "Nothing here with these filters."}
          </p>
        )}
      </section>
      <DetailSheet scope={results} />
    </div>
  );
}

/** A rail entry: a chip on phones, a full row with its count from lg up. Hover fills the row at once: .press's 200ms
 *  colour fade read as lag on a list you sweep the pointer down (durations follow .press's transition list). */
function Row({ on, onClick, n, icon, children }: { on: boolean; onClick: () => void; n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`anim-host press group/job relative flex h-8 flex-none items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] whitespace-nowrap [transition-duration:160ms,60ms,60ms,250ms]! max-lg:shadow-[inset_0_0_0_1px_var(--color-line)] lg:[[data-sheet]_&]:w-9 lg:[[data-sheet]_&]:justify-center lg:[[data-sheet]_&]:px-0 ${on ? "bg-s2 text-fg max-lg:shadow-[inset_0_0_0_1px_var(--color-fg)]" : "text-fg2 hover:bg-s1 hover:text-fg"}`}
    >
      {icon}
      {/* Folded beside an open sheet: the name and count leave the row for a hover label (and stay for screen readers). */}
      <span className="flex-1 text-left lg:[[data-sheet]_&]:sr-only">{children}</span>
      <span className="font-mono text-[11.5px] text-fg3 tabular-nums lg:[[data-sheet]_&]:sr-only">{n}</span>
      <span aria-hidden className="pointer-events-none absolute left-full ml-2 hidden items-center gap-1.5 rounded-md bg-s3 px-2 py-1 text-[12px] text-fg shadow-[0_0_0_1px_var(--color-line2)] lg:[[data-sheet]_&]:group-hover/job:flex">
        {children}
        <span className="font-mono text-[11px] text-fg3 tabular-nums">{n}</span>
      </span>
    </button>
  );
}

function Select<V extends string>({ label, value, shown, onChange, options, className = "" }: { label: string; value: V; shown: string; onChange: (v: string) => void; options: readonly (readonly [V, string])[]; className?: string }) {
  return (
    <label className={`relative inline-flex h-[34px] flex-none items-center gap-1.5 rounded-[9px] bg-s2 pr-7 pl-2.5 text-[12.5px] text-fg2 shadow-[inset_0_0_0_1px_var(--color-line)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue ${className}`}>
      {label} <b className="font-medium text-fg">{shown}</b>
      <ChevronDown size={12} className="absolute right-2.5 text-fg3" />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}

/** List view row: the whole row links to the library; install and save sit above the link. */
function SponsorRow({ sponsor }: { sponsor: Sponsor }) {
  return (
    <li className="relative flex items-center gap-3 border-t border-line px-3 py-2.5 transition-colors first:border-t-0 hover:bg-s1">
      <img src={sponsor.image} alt="" loading="lazy" className="size-[30px] shrink-0 rounded-lg bg-s2 object-cover" />
      <a href={withUtm(sponsor.url, "browse-list")} target="_blank" rel="sponsored noopener" className="min-w-0 flex-1 after:absolute after:inset-0">
        <span className="block font-medium">
          {sponsor.name}
          <ArrowUpRight size={14} className="ml-0.5 inline align-[-1px] text-fg3" aria-hidden />
        </span>
        <span className="block truncate text-[13px] text-fg2">{sponsor.description}</span>
      </a>
      <span className="shrink-0 font-mono text-[11px] tracking-[0.08em] text-fg3 uppercase">Sponsored</span>
    </li>
  );
}

const ListRow = memo(function ListRow({ lib, stat }: { lib: ShelfLib; stat: string }) {
  const fws = lib.frameworks.map((f) => FW[f]);
  return (
    <li className="anim-host relative flex items-center gap-3 border-t border-line px-3 py-2.5 transition-colors first:border-t-0 hover:bg-s1">
      <LibMark lib={lib} size={30} />
      <a href={`/browse/${lib.id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
        <span className="block font-medium">{lib.name}</span>
        <span className="block truncate text-[13px] text-fg2">{lib.tagline}</span>
      </a>
      <span className="flex w-32 shrink-0 items-center gap-2 text-[12.5px] text-fg2 max-md:hidden"><KindIcon kind={lib.kind} size={13} />{kindMeta[lib.kind].label}</span>
      <span className="w-40 shrink-0 truncate font-mono text-[11.5px] text-fg3 max-xl:hidden">{fws.slice(0, 3).join(" · ")}{fws.length > 3 && ` +${fws.length - 3}`}</span>
      <span className={`w-[84px] shrink-0 rounded-md px-1.5 py-0.5 text-center text-[11.5px] max-md:hidden ${lib.paid ? "bg-amber/10 text-amber" : "bg-s2 text-fg2"}`}>{lib.paid ? "Free + paid" : "Free"}</span>
      <span className="w-20 shrink-0 text-right font-mono text-[11.5px] text-fg2 tabular-nums max-sm:hidden">{stat}</span>
      <CopyButton value={lib.install} label="Install" className="relative z-10" />
      <SaveButton id={lib.id} name={lib.name} className="relative z-10" />
    </li>
  );
});
