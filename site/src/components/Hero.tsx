import NumberFlow from "@number-flow/react";
import { ArrowRight, Search, SearchX, X } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TextMorph } from "torph/react";
import type { Listing } from "../lib/categories.ts";
import { cue } from "../lib/sound.ts";
import { useSponsors, withSponsors } from "../lib/sponsors.ts";
import { useTheme } from "../lib/theme.ts";
import { withUtm } from "../lib/utm.ts";
import { ShaderBg } from "./fx.tsx";
import { ListingCard } from "./ListingCard.tsx";
import { Seg } from "./Seg.tsx";

const WORDS = ["ui library", "toast", "drawer", "shader", "icon set", "text morph", "glass", "chart"];
const TRY = ["toast", "bottom sheet", "shader background", "glass"];
const SLOTS = 4;
type Results = { relevant: Listing[]; similar: Listing[] };
type Tab = keyof Results;

/** Hero: morphing headline, live search with a few queries to try, rolling counts and one sponsor row (up to four
 *  names; open slots fold into a single "Sponsor" cell). Lifts and blurs away on scroll. Searching (also from a ?q=
 *  link, which the WebSite JSON-LD's SearchAction points at) folds the hero up and shows Design Index's result grid:
 *  Relevant and Similar tabs with counts, a sponsor first and after every 8th card, Clear, and an empty tab that
 *  points at the other one. */
export default function Hero({ counts }: { counts: { libs: number; resources: number; looks: number } }) {
  const ads = useSponsors("home");
  // The word changes only when the user points at or presses it: the site has no motion on a loop.
  const [w, setW] = useState(0);
  const next = () => setW((i) => (i + 1) % WORDS.length);

  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results>();
  const [tab, setTab] = useState<Tab>("relevant");
  useEffect(() => setQ(new URLSearchParams(location.search).get("q") ?? ""), []);
  useEffect(() => {
    const u = new URL(location.href);
    if (q.trim()) u.searchParams.set("q", q.trim());
    else u.searchParams.delete("q");
    if (u.href !== location.href) history.replaceState(history.state, "", u);
    if (!q.trim()) return setRes(undefined);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.json() as Promise<Results>)
        .then((r) => {
          setRes(r);
          setTab(r.relevant.length || !r.similar.length ? "relevant" : "similar");
          cue(r.relevant.length + r.similar.length ? "ready" : "warning");
        })
        .catch(() => {});
    }, 200);
    return () => (clearTimeout(t), ctl.abort());
  }, [q]);
  const clear = () => (setQ(""), input.current?.focus());
  const active = !!q.trim();
  const other: Tab = tab === "relevant" ? "similar" : "relevant";

  const [shown, setShown] = useState({ libs: 0, resources: 0, looks: 0 });
  useEffect(() => {
    const t = setTimeout(() => setShown(counts), 300);
    return () => clearTimeout(t);
  }, [counts]);

  const light = useTheme() === "light";
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const blur = useTransform(scrollYProgress, [0, 0.7], ["blur(0px)", "blur(10px)"]);

  const list = res?.[tab] ?? [];
  const grid = ads.filter((ad) => !ad.homepageOnly);
  const strip = ads.slice(0, SLOTS);

  return (
    <section ref={ref} className={`relative isolate flex flex-col items-center px-4 ${active ? "pt-24 pb-16" : "pt-[18svh] pb-20"}`}>
      <ShaderBg className="absolute inset-0 -z-10 opacity-80" colors={light ? ["#ffffff", "#c9d3ff", "#e3d9ff", "#f6f7fb", "#b9ccff"] : ["#000000", "#0b1250", "#2a1a6e", "#05060d", "#123a8a"]} />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-b from-transparent to-bg" />
      {/* While searching, the results scroll with the page: no lift-and-blur. */}
      <motion.div style={active ? undefined : { y, opacity: fade, filter: blur }} className="flex w-full flex-col items-center">
        {!active && (
          <>
            {/* CSS entrance, not motion's: it starts at first paint, before this island hydrates (the page's LCP). */}
            <h1 className="enter text-center text-[clamp(38px,6.4vw,76px)] leading-[1.02] font-semibold tracking-[-0.045em] [text-shadow:0_2px_30px_color-mix(in_srgb,var(--color-fg)_18%,transparent)]">
              find any{" "}
              <button type="button" onClick={next} onPointerEnter={(e) => e.pointerType === "mouse" && next()} className="cursor-pointer rounded-lg outline-offset-4">
                <TextMorph as="span" className="font-serif font-normal italic tracking-[-0.02em]">{WORDS[w] ?? ""}</TextMorph>
              </button>
            </h1>
            <p style={{ animation: "blur-in 600ms var(--ease-quart) 250ms backwards" }} className="mt-4 max-w-[52ch] text-center text-[15px] text-fg2">
              Hand-picked UI libraries, each with a note on when to use it. Your coding agent reads the same notes through MCP.
            </p>
          </>
        )}
        {/* Rises in with CSS from first paint, so the search box shows before the island hydrates on a slow phone. */}
        <div style={{ animation: "enter-late 700ms var(--spring) 350ms backwards" }} className={`w-full max-w-[580px] ${active ? "" : "mt-8"}`}>
          <label className="flex items-center gap-3 rounded-2xl bg-bg/55 px-4 py-3.5 shadow-[0_0_0_1px_var(--color-line2),0_30px_80px_-30px_rgb(0_0_0/0.9)] backdrop-blur-xl transition-shadow duration-300 focus-within:shadow-[0_0_0_1px_rgb(91_124_255/0.7),0_0_0_5px_rgb(91_124_255/0.15)]">
            <Search size={16} className="text-fg3" />
            <input
              ref={input}
              id="ask"
              type="search"
              enterKeyHint="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              placeholder="ask anything, like “animated price” or “bottom sheet”"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg3 [&::-webkit-search-cancel-button]:hidden"
              autoComplete="off"
              aria-label="Search libraries"
              data-sound="type"
            />
            {active ? (
              <button type="button" onClick={clear} data-sound="close" className="press shrink-0 text-[13px] text-fg3 hover:text-fg">clear</button>
            ) : (
              <span className="kbd">/</span>
            )}
          </label>
          {!active && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[13px] text-fg2">
              <span className="pr-1 text-fg3 max-sm:hidden">Try</span>
              {TRY.map((t) => (
                <button key={t} type="button" onClick={() => setQ(t)} data-sound="tap" className="press h-7 rounded-lg bg-bg/40 px-2.5 shadow-[inset_0_0_0_1px_var(--color-line2)] backdrop-blur-xl transition-colors hover:text-fg">{t}</button>
              ))}
              <a href="/match" data-sound="navigate" className="press inline-flex h-7 items-center rounded-lg bg-bg/40 px-2.5 shadow-[inset_0_0_0_1px_var(--color-line2)] backdrop-blur-xl transition-colors hover:text-fg">match a screenshot →</a>
            </div>
          )}
        </div>
        {!active && (
          <>
            <p className="mt-6 font-mono text-[12px] text-fg3 tabular-nums [&_b]:font-medium [&_b]:text-fg">
              <b><NumberFlow value={shown.libs} /></b> libraries · <b><NumberFlow value={shown.looks} /></b> looks · <b><NumberFlow value={shown.resources} /></b> resources
            </p>
            <ul className="mt-8 flex w-full max-w-[600px] flex-wrap border-y border-line2 max-sm:[&>li:nth-child(n+4)]:border-t" aria-label="Sponsors">
              <li className="flex items-center pr-4 font-mono text-[11px] tracking-[0.08em] text-fg3 uppercase max-sm:hidden" aria-hidden>Sponsors</li>
              {strip.map((ad) => (
                <li key={ad.id} className="flex h-12 flex-1 border-line2 max-sm:basis-1/2 sm:border-l max-sm:[&:nth-child(odd)]:border-l">
                  <a href={withUtm(ad.url, "home-strip")} target="_blank" rel="sponsored noopener" className="grid flex-1 place-items-center truncate px-3 text-[15px] font-semibold tracking-[-0.01em] text-fg2 transition-colors hover:text-fg">{ad.name}</a>
                </li>
              ))}
              {strip.length < SLOTS && (
                <li className={`flex h-12 border-line2 sm:border-l max-sm:basis-full ${strip.length ? "flex-1" : "flex-[3]"} ${strip.length === 1 ? "max-sm:border-t" : ""}`}>
                  <a href="/sponsor" data-sound="navigate" className="group flex flex-1 items-center justify-between gap-3 px-3 text-[13px] text-fg3 transition-colors hover:text-fg">
                    {strip.length ? `${SLOTS - strip.length} open` : "Your logo here, seen by people picking UI libraries"}
                    <span className="shrink-0 text-fg">Sponsor <ArrowRight size={13} className="inline transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden /></span>
                  </a>
                </li>
              )}
            </ul>
          </>
        )}
      </motion.div>

      {active && res && (
        <div className="mt-8 w-full max-w-[1100px]" aria-live="polite">
          {res.relevant.length + res.similar.length ? (
            <>
              <div className="mb-5 flex items-center justify-between gap-3">
                <Seg label="Result type">
                  {(["relevant", "similar"] as const).map((t) => (
                    <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} data-sound="select" className="flex items-center gap-1.5 capitalize">
                      {t}
                      <span className="text-fg3 tabular-nums">{res[t].length}</span>
                    </button>
                  ))}
                </Seg>
                <button type="button" onClick={clear} data-sound="close" className="press inline-flex h-8 items-center gap-1.5 rounded-lg bg-bg/55 px-2.5 text-[13px] font-semibold text-fg shadow-[inset_0_0_0_1px_var(--color-line2)] backdrop-blur-xl hover:bg-s2">
                  <X size={14} aria-hidden />
                  Clear
                </button>
              </div>
              {list.length ? (
                <div className="grid grid-cols-2 gap-3 pb-6 sm:gap-5 lg:grid-cols-3">
                  {withSponsors(list, grid).map((slot, i) => ("sponsor" in slot ? <ListingCard key={slot.key} sponsor={slot.sponsor} where="search-results" /> : <ListingCard key={slot.key} item={slot.item} actions eager={i < 3} />))}
                </div>
              ) : (
                <Empty title={`No ${tab} results`} body={`Nothing fit closely enough here, but ${res[other].length} ${res[other].length === 1 ? "library was" : "libraries were"} found in the other tab.`}>
                  <button type="button" onClick={() => setTab(other)} data-sound="tap" className="press group mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-fg pr-2.5 pl-4 text-[13.5px] font-semibold text-bg hover:opacity-90">
                    View {other} results
                    <span className="flex h-6 items-center gap-1 rounded-lg bg-bg/15 pr-1.5 pl-2 text-[12px] tabular-nums">
                      {res[other].length}
                      <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </button>
                </Empty>
              )}
            </>
          ) : (
            <Empty title="No libraries fit that" body="Try the job in other words, like “toast” or “bottom sheet”, or browse every library.">
              <a href="/browse" className="press mt-5 inline-flex h-10 items-center rounded-xl bg-fg px-4 text-[13.5px] font-semibold text-bg hover:opacity-90">Browse libraries</a>
            </Empty>
          )}
        </div>
      )}
    </section>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div role="status" className="flex min-h-56 flex-col items-center justify-center rounded-xl bg-s1 px-6 py-10 text-center shadow-[inset_0_0_0_1px_var(--color-line)]">
      <span className="grid size-10 place-items-center rounded-full bg-s3 text-fg2"><SearchX size={18} aria-hidden /></span>
      <p className="mt-4 text-[17px] font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-[13.5px] text-fg2">{body}</p>
      {children}
    </div>
  );
}
