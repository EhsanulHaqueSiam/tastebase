import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { CopyButton } from "./fx.tsx";

const TABS = ["usage", "prompt.md", "install"] as const;

/** Bottom pane on a library page: usage, the agent note (prompt.md) and the install command. */
export default function CodeTabs({ usage, prompt, install }: { usage: string; prompt: string; install: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("usage");
  const body = tab === "usage" ? usage : tab === "install" ? install : prompt;
  return (
    <div className="h-[260px] shrink-0 border-t border-line bg-s1">
      <div className="flex h-10 items-center gap-1 border-b border-line px-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="press relative h-7 rounded-md px-2.5 font-mono text-[12px] text-fg2">
            {tab === t && <motion.span layoutId="codetab" className="absolute inset-0 rounded-md bg-s3" transition={{ type: "spring", duration: 0.35, bounce: 0.1 }} />}
            <span className={`relative ${tab === t ? "text-fg" : ""}`}>{t}</span>
          </button>
        ))}
        <span className="flex-1" />
        <CopyButton value={body} quiet />
      </div>
      <AnimatePresence mode="wait">
        <motion.pre key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="h-[218px] overflow-auto p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-fg/85">
          {body}
        </motion.pre>
      </AnimatePresence>
    </div>
  );
}
