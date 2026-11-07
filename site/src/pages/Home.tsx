import NumberFlow from "@number-flow/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, CornerDownLeft, Search, Sparkles, Wand2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useScroll, useTransform } from "motion/react";
import { GrainGradient } from "@paper-design/shaders-react";
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

// Below the fold and heavy (it pulls every demo library), so it loads after first paint.
const TouchIt = lazy(() => import("../components/TouchIt.tsx"));
import { TextMorph } from "torph/react";
import { pick, plan } from "../../../src/engine.ts";
import { formatPlan } from "../../../src/format.ts";
import { aesthetics, kindMeta, libraries, shot, type Kind } from "../data.ts";
import { CopyButton, Magnetic, Rise, ShaderBg, SpotCard } from "../components/fx.tsx";
import { LibMark } from "../components/LibMark.tsx";

const WORDS = ["ui library", "toast", "drawer", "shader", "icon set", "text morph", "glass", "chart"];
const BRIEFS = [
  "iOS-feel habit tracker with a bottom sheet and animated stats",
  "dev-tool landing page like Resend with a shader hero",
  "playful onboarding flow with confetti-level delight",
  "dense analytics dashboard with charts and a command menu",
];

export function Home() {
  return (
    <>
      <Hero />
      <PlanDemo />
      <Suspense fallback={<div className="h-[1000px]" />}>
        <TouchIt />
      </Suspense>
      <Gallery />
      <Setup />
      <Footer />
    </>
  );
}

function Hero() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setW((i) => (i + 1) % WORDS.length), 2400);
    return () => clearInterval(t);
  }, []);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const hits = useMemo(() => (dq.trim() ? pick(libraries, dq, { limit: 5 }) : []), [dq]);
  const [counts, setCounts] = useState({ libs: 0, looks: 0, kinds: 0 });
  useEffect(() => {
    const t = setTimeout(() => setCounts({ libs: libraries.length, looks: aesthetics.length, kinds: Object.keys(kindMeta).length }), 300);
    return () => clearTimeout(t);
  }, []);

  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const blur = useTransform(scrollYProgress, [0, 0.7], ["blur(0px)", "blur(10px)"]);

  return (
    <section ref={ref} className="relative isolate flex min-h-[92svh] flex-col items-center px-4 pt-[22svh] pb-24">
      <ShaderBg className="absolute inset-0 -z-10 opacity-80" colors={["#000000", "#0b1250", "#2a1a6e", "#05060d", "#123a8a"]} />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-b from-transparent to-black" />

      <motion.div style={{ y, opacity: fade, filter: blur }} className="flex w-full flex-col items-center">
      <motion.h1
        initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
        className="text-center text-[clamp(38px,6.4vw,76px)] leading-[1.02] font-semibold tracking-[-0.045em] [text-shadow:0_2px_30px_rgb(255_255_255/0.18)]"
      >
        find any <TextMorph as="span" className="font-serif font-normal italic tracking-[-0.02em] text-white">{WORDS[w] ?? ""}</TextMorph>
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.6 }} className="mt-4 max-w-[52ch] text-center text-[15px] text-fg2">
        Hand-picked UI libraries, each with a note on when to use it. Your coding agent reads the same notes through MCP.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.35, type: "spring", duration: 0.7, bounce: 0.2 }}
        className="mt-8 w-full max-w-[580px]"
      >
        <label className="flex items-center gap-3 rounded-2xl bg-black/55 px-4 py-3.5 shadow-[0_0_0_1px_var(--color-line2),0_30px_80px_-30px_rgb(0_0_0/0.9)] backdrop-blur-xl transition-shadow duration-300 focus-within:shadow-[0_0_0_1px_rgb(91_124_255/0.7),0_0_0_5px_rgb(91_124_255/0.15)]">
          <Search size={16} className="text-fg3" />
          <input
            id="ask"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ask anything, like “animated price” or “bottom sheet”"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg3"
            autoComplete="off"
          />
          <span className="kbd">/</span>
        </label>
        <motion.ul layout className="mt-2 overflow-hidden rounded-2xl bg-black/70 backdrop-blur-xl" style={{ boxShadow: hits.length ? "0 0 0 1px var(--color-line2)" : "none" }}>
          <AnimatePresence initial={false}>
            {hits.map((h, i) => (
              <motion.li
                key={h.lib.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.035 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                <Link to="/browse/$id" params={{ id: h.lib.id }} className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/5">
                  <LibMark lib={h.lib} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{h.lib.name}</span>
                    <span className="block truncate text-[13px] text-fg2">{h.why}</span>
                  </span>
                  <CornerDownLeft size={14} className="text-fg3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </motion.div>

      <div className="mt-6 flex flex-wrap justify-center gap-5 text-[13px] text-fg2 tabular-nums">
        <span><NumberFlow value={counts.libs} /> libraries</span>
        <span><NumberFlow value={counts.looks} /> looks</span>
        <span><NumberFlow value={counts.kinds} /> kinds of job</span>
      </div>
      </motion.div>
    </section>
  );
}

function PlanDemo() {
  const [brief, setBrief] = useState(BRIEFS[0] ?? "");
  const p = useMemo(() => plan(libraries, aesthetics, brief), [brief]);
  return (
    <section id="plan" className="mx-auto max-w-6xl px-4 py-28">
      <Rise>
        <h2 className="text-[clamp(28px,3.6vw,44px)] leading-tight font-semibold tracking-[-0.035em]">Describe the app. Get the stack.</h2>
        <p className="mt-2 max-w-[60ch] text-[15px] text-fg2">This box runs the same <code className="font-mono text-[13px] text-fg">plan</code> tool your agent calls. It reads the look from your words, then picks one library per job.</p>
      </Rise>
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.25fr]">
        <Rise delay={0.05} className="flex flex-col gap-3">
          <div className="rounded-2xl bg-s1 p-1.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl bg-transparent p-3 text-[15px] outline-none"
              aria-label="App brief"
            />
            <div className="flex flex-wrap gap-1.5 p-1.5">
              {BRIEFS.map((b) => (
                <button key={b} onClick={() => setBrief(b)} className={`press rounded-full px-3 py-1.5 text-[12.5px] ${b === brief ? "bg-fg text-black" : "bg-s3 text-fg2 hover:text-fg"}`}>
                  {b.split(" with")[0]}
                </button>
              ))}
            </div>
          </div>
          <SpotCard className="rounded-2xl bg-s1 p-5 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <div className="flex items-center gap-2 text-[13px] text-fg2"><Wand2 size={14} className="text-violet" /> Look</div>
            <TextMorph as="div" className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{p.look.name}</TextMorph>
            <p className="mt-1 text-fg2">{p.look.summary}</p>
            <dl className="mt-4 grid gap-2 text-[13px]">
              {(["type", "colour", "motion"] as const).map((k) => (
                <div key={k} className="grid grid-cols-[64px_1fr] gap-2"><dt className="text-fg3 capitalize">{k}</dt><dd className="text-fg/90">{p.look[k]}</dd></div>
              ))}
            </dl>
          </SpotCard>
        </Rise>
        <Rise delay={0.1}>
          <LayoutGroup>
            <ul className="grid grid-cols-1 gap-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {p.items.filter((it) => it.pick).map((it, i) => {
                  const m = kindMeta[it.kind];
                  const lib = it.pick!.lib;
                  return (
                    <motion.li
                      key={`${it.kind}-${lib.id}`}
                      layout
                      initial={{ opacity: 0, x: 16, filter: "blur(4px)" }}
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)", transition: { delay: i * 0.04, type: "spring", duration: 0.5, bounce: 0.15 } }}
                      exit={{ opacity: 0, x: -12, filter: "blur(4px)", transition: { duration: 0.15 } }}
                    >
                      <SpotCard className="flex items-center gap-3 rounded-xl bg-s1 p-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-s3" style={{ color: m.color }}><m.icon size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2"><span className="text-[12px] text-fg3">{m.label}</span><Link to="/browse/$id" params={{ id: lib.id }} className="font-medium hover:underline">{lib.name}</Link></span>
                          <span className="block truncate text-[13px] text-fg2">{it.pick!.why}</span>
                        </span>
                        <CopyButton value={lib.install} label="Install" quiet />
                      </SpotCard>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </LayoutGroup>
        </Rise>
      </div>
    </section>
  );
}

function Gallery() {
  const kinds = useMemo(() => ["all", ...new Set(libraries.map((l) => l.kind))] as ("all" | Kind)[], []);
  const [k, setK] = useState<"all" | Kind>("all");
  const list = libraries.filter((l) => k === "all" || l.kind === k).slice(0, 12);
  return (
    <section id="gallery" className="mx-auto max-w-6xl px-4 py-24">
      <Rise className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-[clamp(28px,3.6vw,44px)] leading-tight font-semibold tracking-[-0.035em]">The shelf</h2>
        <Link to="/browse" className="press group inline-flex items-center gap-1.5 text-fg2 hover:text-fg">Browse all <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" /></Link>
      </Rise>
      <div className="mt-6 flex flex-wrap gap-1">
        {kinds.map((x) => (
          <button key={x} onClick={() => setK(x)} className="press relative rounded-full px-3 py-1.5 text-[13px]">
            {k === x && <motion.span layoutId="kindpill" className="absolute inset-0 rounded-full bg-s3" transition={{ type: "spring", duration: 0.45, bounce: 0.15 }} />}
            <span className={`relative ${k === x ? "text-fg" : "text-fg2"}`}>{x === "all" ? "All" : kindMeta[x].label}</span>
          </button>
        ))}
      </div>
      <motion.div layout className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((l, i) => (
            <motion.div key={l.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.03 } }} exit={{ opacity: 0, scale: 0.96 }}>
              <Link to="/browse/$id" params={{ id: l.id }} className="group block">
                <SpotCard className="overflow-hidden rounded-2xl bg-s1 shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow duration-300 group-hover:shadow-[inset_0_0_0_1px_var(--color-line2)]">
                  <div className="relative aspect-[16/10] overflow-hidden bg-s2">
                    <img src={shot(l.id)} alt={`${l.name} website`} loading="lazy" className="size-full object-cover object-top transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                    <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-s1 to-transparent" />
                  </div>
                  <div className="flex items-center gap-3 p-4 pt-1">
                    <LibMark lib={l} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{l.name}</span>
                      <span className="block truncate text-[13px] text-fg2">{l.tagline}</span>
                    </span>
                    <ArrowUpRight size={16} className="text-fg3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
                  </div>
                </SpotCard>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}

function Setup() {
  const sample = useMemo(() => formatPlan(plan(libraries, aesthetics, "iOS-feel habit tracker with a bottom sheet and animated stats")), []);
  return (
    <section id="mcp" className="mx-auto max-w-6xl px-4 py-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr]">
        <Rise>
          <div className="flex items-center gap-2 text-[13px] text-fg2"><Sparkles size={14} className="text-amber" /> For Claude Code, Cursor, Codex</div>
          <h2 className="mt-2 text-[clamp(28px,3.6vw,44px)] leading-tight font-semibold tracking-[-0.035em]">One command. Better UI from every prompt.</h2>
          <p className="mt-3 max-w-[50ch] text-[15px] text-fg2">Three tools, short text answers. Your agent asks before it writes UI, installs what fits, and follows the look's rules.</p>
          <div className="mt-6 grid grid-cols-1 gap-2">
            {["claude mcp add tastebase -- npx -y tastebase", "npx skills add EhsanulHaqueSiam/tastebase"].map((c) => (
              <div key={c} className="flex items-center gap-2 rounded-xl bg-s1 py-1.5 pr-1.5 pl-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg/90">{c}</code>
                <CopyButton value={c} />
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Magnetic>
              <Link to="/browse" className="sweep press inline-flex h-11 items-center gap-2 rounded-xl bg-fg px-5 font-medium text-black hover:shadow-[0_0_0_5px_rgb(255_255_255/0.1)]">
                Browse the shelf <ArrowRight size={16} />
              </Link>
            </Magnetic>
          </div>
        </Rise>
        <Rise delay={0.1}>
          <div className="overflow-hidden rounded-2xl bg-s1 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[12.5px] text-fg2"><span className="size-2 rounded-full bg-green" /> What Claude gets back from <code className="font-mono text-fg">plan</code></div>
            <pre className="max-h-[420px] overflow-auto p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-fg/85">{sample}</pre>
          </div>
        </Rise>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative isolate mt-24 overflow-hidden pt-24 pb-36">
      <div className="absolute inset-0 -z-10 opacity-70" aria-hidden>
        <GrainGradient colorBack="#000000" colors={["#5b7cff", "#b197fc", "#f78fc4", "#3bd4e8"]} softness={0.7} intensity={0.4} noise={0.35} shape="wave" speed={0.3} style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-black to-transparent" />
      <motion.div
        initial={{ clipPath: "inset(0 0 100% 0)", y: 40 }}
        whileInView={{ clipPath: "inset(0 0 0% 0)", y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.1, ease: [0.77, 0, 0.175, 1] }}
        className="px-4 text-center text-[clamp(64px,17vw,260px)] leading-[0.85] font-semibold tracking-[-0.06em] mix-blend-plus-lighter"
      >
        tastebase
      </motion.div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-between gap-4 px-4 text-[13px] text-fg2">
        <span>Every library here belongs to its authors. We only write the notes.</span>
        <span className="flex gap-4"><Link to="/browse" className="hover:text-fg">Browse</Link><a href="#mcp" className="hover:text-fg">MCP</a><a href="https://github.com/EhsanulHaqueSiam/tastebase" className="hover:text-fg">GitHub</a></span>
      </div>
    </footer>
  );
}
