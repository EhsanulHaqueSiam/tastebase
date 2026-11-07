import { Wand2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useState } from "react";
import { TextMorph } from "torph/react";
import { kindMeta } from "../lib/kinds.ts";
import type { PlanJson } from "../lib/server.ts";
import { CopyButton, Rise, SpotCard } from "./fx.tsx";

/** The `plan` tool, live: edit the brief, the stack re-ranks. First result is server-rendered. */
export default function PlanDemo({ initial, briefs }: { initial: PlanJson; briefs: string[] }) {
  const [brief, setBrief] = useState(briefs[0] ?? "");
  const [p, setP] = useState(initial);
  useEffect(() => {
    if (brief === briefs[0]) return setP(initial);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/plan?brief=${encodeURIComponent(brief)}`, { signal: ctl.signal })
        .then((r) => r.json() as Promise<PlanJson>)
        .then(setP)
        .catch(() => {});
    }, 220);
    return () => (clearTimeout(t), ctl.abort());
  }, [brief]);

  return (
    <section id="plan" className="mx-auto max-w-6xl px-4 py-28">
      <Rise>
        <h2 className="text-[clamp(28px,3.6vw,44px)] leading-tight font-semibold tracking-[-0.035em]">Describe the app. Get the stack.</h2>
        <p className="mt-2 max-w-[60ch] text-[15px] text-fg2">This box calls the same <code className="font-mono text-[13px] text-fg">plan</code> tool your agent uses. It reads the look from your words, then picks one library per job.</p>
      </Rise>
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.25fr]">
        <Rise delay={0.05} className="flex flex-col gap-3">
          <div className="rounded-2xl bg-s1 p-1.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} className="w-full resize-none rounded-xl bg-transparent p-3 text-[15px] outline-none" aria-label="App brief" />
            <div className="flex flex-wrap gap-1.5 p-1.5">
              {briefs.map((b) => (
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
                {p.items.map((it, i) => {
                  const m = kindMeta[it.kind];
                  return (
                    <motion.li
                      key={`${it.kind}-${it.lib.id}`}
                      layout
                      initial={{ opacity: 0, x: 16, filter: "blur(4px)" }}
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)", transition: { delay: i * 0.04, type: "spring", duration: 0.5, bounce: 0.15 } }}
                      exit={{ opacity: 0, x: -12, filter: "blur(4px)", transition: { duration: 0.15 } }}
                    >
                      <SpotCard className="flex items-center gap-3 rounded-xl bg-s1 p-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-s3" style={{ color: m.color }}><m.icon size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2"><span className="text-[12px] text-fg3">{m.label}</span><a href={`/browse/${it.lib.id}`} className="font-medium hover:underline">{it.lib.name}</a></span>
                          <span className="block truncate text-[13px] text-fg2">{it.why}</span>
                        </span>
                        <CopyButton value={it.lib.install} label="Install" quiet />
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
