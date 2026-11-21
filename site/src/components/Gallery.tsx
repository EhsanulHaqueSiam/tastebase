import { ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useState, type ComponentProps } from "react";
import { frameworks, type Framework } from "../../../src/registry/schema.ts";
import { kindMeta } from "../lib/kinds.ts";
import type { LookChip, ShelfLib } from "../lib/server.ts";
import { useStats } from "../lib/stats.ts";
import { ArrowLink, Rise } from "./fx.tsx";
import { FW, LibCard, SORTS, sortBy, statBadge, type Sort } from "./LibCard.tsx";
import { Seg } from "./Seg.tsx";

const SHOWN = 12;
const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

/** The shelf: screenshot cards with search, framework, sort and look filters. A look's picks lead, marked "pick". */
export default function Gallery({ libs, looks }: { libs: ShelfLib[]; looks: LookChip[] }) {
  const stats = useStats();
  const [q, setQ] = useState("");
  const [lookId, setLookId] = useState<string>();
  const [fw, setFw] = useState<Framework>();
  const [sort, setSort] = useState<Sort>("hot");
  const [showAll, setShowAll] = useState(false);

  const look = looks.find((l) => l.id === lookId);
  const family = look?.family ?? look?.id;
  const picks = new Set(look?.picks);
  const terms = words(q);
  // Typing a style's name offers it as a look chip. Families are always in the row.
  const offers = q.trim().length > 1 ? looks.filter((l) => l.family && l.id !== lookId && terms.every((t) => [l.name, l.id, ...l.signals].join(" ").toLowerCase().includes(t))).slice(0, 3) : [];
  const order = sortBy(sort, stats);
  const list = libs
    .filter((l) => !fw || l.frameworks.includes(fw))
    .filter((l) => !family || l.aesthetic.some((a) => a === family) || picks.has(l.id))
    .filter((l) => terms.every((t) => `${l.name} ${l.tagline} ${kindMeta[l.kind].label} ${l.aesthetic.join(" ")}`.toLowerCase().includes(t)))
    .sort((a, b) => Number(picks.has(b.id)) - Number(picks.has(a.id)) || order(a, b));
  const shown = showAll ? list : list.slice(0, SHOWN);

  const chooseLook = (id?: string) => {
    if (looks.find((l) => l.id === id)?.family) setQ(""); // the words were for the look, not for library names
    setLookId(id);
    setShowAll(false);
  };
  const reset = () => (setQ(""), setLookId(undefined), setFw(undefined), setShowAll(false));

  return (
    <section id="gallery" aria-labelledby="shelf" className="mx-auto max-w-6xl px-4 py-24">
      <Rise className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="shelf" className="text-[clamp(28px,3.6vw,44px)] leading-tight font-semibold tracking-[-0.035em]">The shelf</h2>
        <ArrowLink href="/browse" className="h-9 text-[13.5px]">Browse all</ArrowLink>
      </Rise>

      <div className="mt-[18px] flex flex-wrap items-center gap-2">
        <label className="flex h-[34px] min-w-0 flex-[1_1_260px] items-center gap-2 rounded-[9px] bg-s2 px-2.5 shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)]">
          <Search size={14} className="shrink-0 text-fg3" />
          <input
            type="search"
            value={q}
            onChange={(e) => (setQ(e.target.value), setShowAll(false))}
            placeholder="Name, job or look, like “toast” or “claymorphism”"
            aria-label="Search the shelf"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg3 [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <label className="relative inline-flex h-[34px] flex-none items-center gap-1.5 rounded-[9px] bg-s2 pr-7 pl-2.5 text-[12.5px] text-fg2 shadow-[inset_0_0_0_1px_var(--color-line)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue">
          Framework <b className="font-medium text-fg">{fw ? FW[fw] : "Any"}</b>
          <ChevronDown size={12} className="absolute right-2.5 text-fg3" />
          <select value={fw ?? ""} onChange={(e) => (setFw(frameworks.find((f) => f === e.target.value)), setShowAll(false))} aria-label="Framework" className="absolute inset-0 cursor-pointer opacity-0">
            <option value="">Any</option>
            {frameworks.map((f) => <option key={f} value={f}>{FW[f]}</option>)}
          </select>
        </label>
        <Seg label="Sort">
          {SORTS.map(([id, label]) => <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>)}
        </Seg>
      </div>

      <div role="group" aria-label="Look" className="mt-2.5 flex gap-1.5 overflow-x-auto p-0.5 [scrollbar-width:none]">
        <Chip on={!lookId} onClick={() => chooseLook()}>Any look</Chip>
        {look?.family && <Chip on accent onClick={() => chooseLook()} aria-label={`Clear look ${look.name}`}><Swatch look={look} />{look.name}<X size={12} /></Chip>}
        {offers.map((l) => <Chip key={l.id} on={false} accent onClick={() => chooseLook(l.id)}><Swatch look={l} />Look: {l.name}</Chip>)}
        {looks.filter((l) => !l.family).map((f) => <Chip key={f.id} on={family === f.id} onClick={() => chooseLook(f.id)}><Swatch look={f} />{f.name}</Chip>)}
      </div>

      <div className="mt-3.5 flex justify-between gap-2 text-[12.5px] text-fg3">
        <span aria-live="polite">
          {list.length} {list.length === 1 ? "library" : "libraries"}
          {look && ` for ${look.name}`}
          {fw && ` on ${FW[fw]}`}
          {q.trim() && ` matching “${q.trim()}”`}, {SORTS.find(([id]) => id === sort)![2]}
        </span>
        <button type="button" onClick={reset} disabled={!q && !lookId && !fw} className="text-fg2 transition-colors hover:text-fg disabled:opacity-40 disabled:hover:text-fg2">Reset</button>
      </div>

      <MotionConfig reducedMotion="user">
        <motion.div layout className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {shown.map((l, i) => (
                <motion.div key={l.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1, transition: { delay: (i % SHOWN) * 0.02 } }} exit={{ opacity: 0, scale: 0.96 }}>
                  <LibCard lib={l} badge={statBadge(sort, stats?.[l.id])} pick={picks.has(l.id)} />
                </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </MotionConfig>
      {!list.length && <p className="py-12 text-center text-fg3">{offers.length ? "No library is called that. Pick the look above to see what fits it." : "Nothing on the shelf for that. Try another framework or look."}</p>}
      {!showAll && list.length > SHOWN && (
        <button type="button" onClick={() => setShowAll(true)} className="press mx-auto mt-[18px] flex h-9 items-center rounded-[9px] bg-s2 px-4 text-[13px] shadow-[inset_0_0_0_1px_var(--color-line2)] hover:bg-s3">
          Show all {list.length}
        </button>
      )}
    </section>
  );
}

function Chip({ on, accent, ...rest }: { on: boolean; accent?: boolean } & ComponentProps<"button">) {
  const ring = accent ? "text-fg shadow-[inset_0_0_0_1px_var(--color-blue)]" : on ? "text-fg shadow-[inset_0_0_0_1px_var(--color-fg)]" : "text-fg2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-fg";
  return <button type="button" aria-pressed={on} className={`press flex h-[30px] flex-none items-center gap-[7px] rounded-lg pr-2.5 pl-[7px] text-[12.5px] first:pl-2.5 ${ring}`} {...rest} />;
}

/** A look's ground with its accent in the corner. */
function Swatch({ look }: { look: LookChip }) {
  return (
    <span aria-hidden className="relative size-4 shrink-0 overflow-hidden rounded shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]" style={{ background: look.bg }}>
      <i className="absolute right-0.5 bottom-0.5 size-1.5 rounded-[2px]" style={{ background: look.accent }} />
    </span>
  );
}
