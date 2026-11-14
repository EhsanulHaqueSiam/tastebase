import { ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useState, type ComponentProps } from "react";
import { frameworks, type Framework } from "../../../src/registry/schema.ts";
import { kindMeta, shot } from "../lib/kinds.ts";
import type { LookChip, ShelfLib } from "../lib/server.ts";
import { useStats } from "../lib/stats.ts";
import { ArrowLink, CopyButton, Rise, SpotCard } from "./fx.tsx";
import { GithubMark } from "./GithubMark.tsx";
import { LibMark } from "./LibMark.tsx";

const SORTS = [
  ["hot", "Hot this week", "hottest this week first"],
  ["stars", "Stars", "most stars first"],
  ["name", "A to Z", "A to Z"],
] as const;
type Sort = (typeof SORTS)[number][0];
const FW: Record<Framework, string> = { react: "React", vue: "Vue", svelte: "Svelte", solid: "Solid", angular: "Angular", vanilla: "Vanilla JS", "react-native": "React Native" };
const SHOWN = 12;
const compact = new Intl.NumberFormat("en", { notation: "compact" });
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
  const n = (id: string, k: "stars" | "starsWeek") => stats?.[id]?.[k] ?? 0;
  const order = {
    hot: (a: ShelfLib, b: ShelfLib) => n(b.id, "starsWeek") - n(a.id, "starsWeek") || n(b.id, "stars") - n(a.id, "stars"),
    stars: (a: ShelfLib, b: ShelfLib) => n(b.id, "stars") - n(a.id, "stars"),
    name: (a: ShelfLib, b: ShelfLib) => a.name.localeCompare(b.name),
  }[sort];
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
        <div className="seg" role="group" aria-label="Sort">
          {SORTS.map(([id, label]) => <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)}>{label}</button>)}
        </div>
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
            {shown.map((l, i) => {
              const s = stats?.[l.id];
              const badge = sort === "hot" ? (s?.starsWeek ? `+${compact.format(s.starsWeek)}★ wk` : "") : sort === "stars" && s?.stars ? `${compact.format(s.stars)}★` : "";
              return (
                <motion.div key={l.id} layout className="group relative" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1, transition: { delay: (i % SHOWN) * 0.02 } }} exit={{ opacity: 0, scale: 0.96 }}>
                  <a href={`/browse/${l.id}`} className="block">
                    <SpotCard className="overflow-hidden rounded-2xl bg-s1 shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow duration-300 group-hover:shadow-[inset_0_0_0_1px_var(--color-line2)]">
                      <div className="relative aspect-[16/10] overflow-hidden bg-s2">
                        <img src={shot(l.id)} alt={`${l.name} website`} loading="lazy" className="size-full object-cover object-top transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]" />
                        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-s1 to-transparent" />
                        {badge && <span className="absolute top-2.5 left-2.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[11px] font-medium text-fg backdrop-blur-md">{badge}</span>}
                        {picks.has(l.id) && <span className="absolute top-2.5 right-2.5 rounded-md bg-fg px-1.5 py-0.5 font-mono text-[11px] font-medium text-black">pick</span>}
                      </div>
                      <div className="flex items-center gap-3 p-4 pt-1">
                        <LibMark lib={l} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{l.name}</span>
                          <span className="block truncate text-[13px] text-fg2">{l.tagline}</span>
                        </span>
                        <span className="card-kind shrink-0 font-mono text-[11.5px] text-fg3">{kindMeta[l.kind].short}</span>
                      </div>
                    </SpotCard>
                  </a>
                  {/* Outside the link so the buttons are not nested in it; they sit over the kind label. */}
                  <div className="card-acts absolute right-3 bottom-[15px] flex gap-1 bg-[linear-gradient(to_left,var(--color-s1)_75%,transparent)] pl-8">
                    <CopyButton value={l.install} label="Install" className="h-8" />
                    {l.repo && (
                      <a href={l.repo} target="_blank" rel="noreferrer" aria-label={`${l.name} on GitHub`} className="press grid size-8 place-items-center rounded-lg bg-s3 text-fg2 hover:bg-fg hover:text-black">
                        <GithubMark size={14} />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
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
