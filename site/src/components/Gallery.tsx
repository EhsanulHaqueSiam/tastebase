import { ArrowRight, ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Kind } from "../../../src/registry/schema.ts";
import { kindMeta, shot } from "../lib/kinds.ts";
import type { Lite } from "../lib/server.ts";
import { isHot, useStats } from "../lib/stats.ts";
import { Rise, SpotCard } from "./fx.tsx";
import { LibMark } from "./LibMark.tsx";

/** The shelf: kind filter with a sliding pill, screenshot cards that re-flow on filter. */
export default function Gallery({ libs }: { libs: Lite[] }) {
  const kinds = ["all", ...new Set(libs.map((l) => l.kind))] as ("all" | Kind)[];
  const [k, setK] = useState<"all" | Kind>("all");
  const stats = useStats();
  const list = libs.filter((l) => k === "all" || l.kind === k).slice(0, 12);
  return (
    <section id="gallery" className="mx-auto max-w-6xl px-4 py-24">
      <Rise className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-[clamp(28px,3.6vw,44px)] leading-tight font-semibold tracking-[-0.035em]">The shelf</h2>
        <a href="/browse" className="press group inline-flex items-center gap-1.5 text-fg2 hover:text-fg">Browse all <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" /></a>
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
              <a href={`/browse/${l.id}`} className="group block">
                <SpotCard className="overflow-hidden rounded-2xl bg-s1 shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow duration-300 group-hover:shadow-[inset_0_0_0_1px_var(--color-line2)]">
                  <div className="relative aspect-[16/10] overflow-hidden bg-s2">
                    <img src={shot(l.id)} alt={`${l.name} website`} loading="lazy" className="size-full object-cover object-top transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]" />
                    <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-s1 to-transparent" />
                    {isHot(stats?.[l.id]) && <span className="absolute top-3 left-3 rounded-full bg-amber/15 px-2 py-0.5 text-[11px] font-medium text-amber backdrop-blur-md">Hot</span>}
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
              </a>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
