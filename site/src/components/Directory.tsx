// /browse: every library, filtered by job (with live counts), price, framework and words; grid or list; saved ones.
import { ChevronDown, Heart, LayoutGrid, List, Search } from "lucide-react";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { frameworks, kinds, type Framework, type Kind } from "../../../src/registry/schema.ts";
import { kindMeta } from "../lib/kinds.ts";
import { useSaved } from "../lib/saved.ts";
import type { ShelfLib } from "../lib/server.ts";
import { useStats } from "../lib/stats.ts";
import { CopyButton } from "./fx.tsx";
import { FW, KindIcon, LibCard, SaveButton, SORTS, sortBy, statBadge, type Sort } from "./LibCard.tsx";
import { LibMark } from "./LibMark.tsx";
import { Seg } from "./Seg.tsx";

type Job = Kind | "all" | "saved";
const PRICES = [["any", "Any"], ["free", "Free"], ["paid", "Paid"]] as const;
const PAGE = 48; // cards per step: enough to fill a large screen several times over
type Price = (typeof PRICES)[number][0];
const isJob = (v: string | null): v is Job => v === "all" || v === "saved" || kinds.some((k) => k === v);
const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

export default function Directory({ libs }: { libs: ShelfLib[] }) {
  const stats = useStats();
  const saved = useSaved();
  const [job, setJob] = useState<Job>("all");
  const [price, setPrice] = useState<Price>("any");
  const [fw, setFw] = useState<Framework>();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("picks");
  const [view, setView] = useState<"grid" | "list">("grid");
  // Cards mount PAGE at a time as the end comes near: all ~200 at once cost ~300ms of hydration on a slow phone.
  const [limit, setLimit] = useState(PAGE);
  const more = useRef<HTMLDivElement>(null);

  // The job lives in the URL (?job=motion, ?job=saved) so a filtered directory can be linked.
  useEffect(() => {
    const j = new URLSearchParams(location.search).get("job");
    if (isJob(j)) setJob(j);
  }, []);
  useEffect(() => {
    const u = new URL(location.href);
    if (job === "all") u.searchParams.delete("job");
    else u.searchParams.set("job", job);
    history.replaceState(history.state, "", u);
  }, [job]);

  const terms = words(q);
  // Price, framework and words narrow everything; the job picks within that, so job counts follow the other filters.
  const base = libs
    .filter((l) => price === "any" || l.paid === (price === "paid"))
    .filter((l) => !fw || l.frameworks.includes(fw))
    .filter((l) => terms.every((t) => `${l.name} ${l.tagline} ${kindMeta[l.kind].label} ${l.aesthetic.join(" ")}`.toLowerCase().includes(t)));
  const count = (j: Job) => (j === "all" ? base.length : j === "saved" ? base.filter((l) => saved.includes(l.id)).length : base.filter((l) => l.kind === j).length);
  const list = base.filter((l) => (job === "all" ? true : job === "saved" ? saved.includes(l.id) : l.kind === job)).sort(sortBy(sort, stats));
  // Keyed cards are reused across filter changes, so switching jobs mounts at most PAGE new ones.
  const visible = list.slice(0, limit);
  const hasMore = list.length > limit;
  useEffect(() => {
    if (!hasMore || !more.current) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setLimit((n) => n + PAGE), { rootMargin: "1200px" });
    io.observe(more.current);
    return () => io.disconnect();
  }, [hasMore, limit]);
  const jobs = [...kinds].sort((a, b) => count(b) - count(a));
  const title = job === "all" ? "All libraries" : job === "saved" ? "Saved" : kindMeta[job].label;
  const filtered = price !== "any" || fw || q.trim();
  const reset = () => (setPrice("any"), setFw(undefined), setQ(""));

  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 pt-14 lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside aria-label="Jobs" className="flex gap-1 overflow-x-auto border-b border-line px-4 py-3 [scrollbar-width:none] lg:sticky lg:top-14 lg:h-[calc(100svh-4rem)] lg:flex-col lg:gap-px lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-2.5 lg:py-4">
        <Row on={job === "saved"} onClick={() => setJob("saved")} n={count("saved")} icon={<span data-anim="pop" className="grid place-items-center text-pink"><Heart size={15} aria-hidden /></span>}>Saved</Row>
        <Row on={job === "all"} onClick={() => setJob("all")} n={count("all")} icon={<span data-anim="pop" className="grid place-items-center"><LayoutGrid size={15} aria-hidden /></span>}>All libraries</Row>
        <h2 className="hidden px-2 pt-4 pb-1.5 font-mono text-[11.5px] text-fg3 lg:block">Job</h2>
        {jobs.map((k) => (
          <Row key={k} on={job === k} onClick={() => setJob(k)} n={count(k)} icon={<KindIcon kind={k} />}>{kindMeta[k].label}</Row>
        ))}
        <h2 className="hidden px-2 pt-4 pb-1.5 font-mono text-[11.5px] text-fg3 lg:block">Price</h2>
        {/* A wrapper, because .seg's own display would beat Tailwind's `hidden`. */}
        <div className="mx-1 hidden lg:block">
          <Seg label="Price">
            {PRICES.map(([id, label]) => <button key={id} type="button" aria-pressed={price === id} onClick={() => setPrice(id)}>{label}</button>)}
          </Seg>
        </div>
      </aside>

      <section aria-labelledby="dir-title" className="min-w-0 px-4 pt-5 pb-24 lg:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 id="dir-title" className="text-[18px] font-semibold tracking-[-0.02em]">
            {title} <span className="ml-1 font-mono text-[13px] font-medium text-fg3 tabular-nums">{list.length}</span>
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
            <Seg label="Sort">
              {SORTS.map(([id, label]) => <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>)}
            </Seg>
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
          <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((l, i) => <div key={l.id}><LibCard lib={l} badge={statBadge(sort, stats?.[l.id])} eager={i < 3} /></div>)}
          </div>
        ) : (
          <ul className="mt-2.5 overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_var(--color-line)]">
            {visible.map((l) => <ListRow key={l.id} lib={l} stat={statBadge(sort, stats?.[l.id])} />)}
          </ul>
        )}
        {hasMore && <div ref={more} aria-hidden className="h-px" />}

        {!list.length && (
          <p className="py-16 text-center text-fg3">
            {job === "saved" && !saved.length ? "Nothing saved yet. Tap the heart on any library to keep it here." : "Nothing here with these filters."}
          </p>
        )}
      </section>
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
      className={`anim-host press flex h-8 flex-none items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] whitespace-nowrap [transition-duration:160ms,60ms,60ms,250ms]! max-lg:shadow-[inset_0_0_0_1px_var(--color-line)] ${on ? "bg-s2 text-fg max-lg:shadow-[inset_0_0_0_1px_var(--color-fg)]" : "text-fg2 hover:bg-s1 hover:text-fg"}`}
    >
      {icon}
      <span className="flex-1 text-left">{children}</span>
      <span className="font-mono text-[11.5px] text-fg3 tabular-nums">{n}</span>
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
