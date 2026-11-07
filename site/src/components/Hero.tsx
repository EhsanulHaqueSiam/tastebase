import NumberFlow from "@number-flow/react";
import { CornerDownLeft, Search } from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import type { Lite } from "../lib/server.ts";
import { ShaderBg } from "./fx.tsx";
import { LibMark } from "./LibMark.tsx";

const WORDS = ["ui library", "toast", "drawer", "shader", "icon set", "text morph", "glass", "chart"];
type Hit = { lib: Lite; why: string };

/** Hero: morphing headline, live search against /api/pick, rolling counts. Lifts and blurs away on scroll. */
export default function Hero({ counts }: { counts: { libs: number; looks: number; kinds: number } }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setW((i) => (i + 1) % WORDS.length), 2400);
    return () => clearInterval(t);
  }, []);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    if (!q.trim()) return setHits([]);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/pick?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.json() as Promise<Hit[]>)
        .then(setHits)
        .catch(() => {});
    }, 140);
    return () => (clearTimeout(t), ctl.abort());
  }, [q]);

  const [shown, setShown] = useState({ libs: 0, looks: 0, kinds: 0 });
  useEffect(() => {
    const t = setTimeout(() => setShown(counts), 300);
    return () => clearTimeout(t);
  }, [counts]);

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
          find any <TextMorph as="span" className="font-serif font-normal italic tracking-[-0.02em]">{WORDS[w] ?? ""}</TextMorph>
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
            <input id="ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ask anything, like “animated price” or “bottom sheet”" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg3" autoComplete="off" aria-label="Search libraries" />
            <span className="kbd">/</span>
          </label>
          <motion.ul layout className="mt-2 overflow-hidden rounded-2xl bg-black/70 backdrop-blur-xl" style={{ boxShadow: hits.length ? "0 0 0 1px var(--color-line2)" : "none" }}>
            <AnimatePresence initial={false}>
              {hits.map((h, i) => (
                <motion.li key={h.lib.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.035 } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                  <a href={`/browse/${h.lib.id}`} className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/5">
                    <LibMark lib={h.lib} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{h.lib.name}</span>
                      <span className="block truncate text-[13px] text-fg2">{h.why}</span>
                    </span>
                    <CornerDownLeft size={14} className="text-fg3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </motion.div>
        <div className="mt-6 flex flex-wrap justify-center gap-5 text-[13px] text-fg2 tabular-nums">
          <span><NumberFlow value={shown.libs} /> libraries</span>
          <span><NumberFlow value={shown.looks} /> looks</span>
          <span><NumberFlow value={shown.kinds} /> kinds of job</span>
        </div>
      </motion.div>
    </section>
  );
}
