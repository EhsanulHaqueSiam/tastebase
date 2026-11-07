import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { shot } from "../lib/kinds.ts";
import { demos } from "./Demos.tsx";

/** Center pane on a library page: the live demo when we have one, else a screenshot of its site. */
export default function Stage({ id, name, url }: { id: string; name: string; url: string }) {
  const Demo = demos[id];
  const [view, setView] = useState<"demo" | "site">(Demo ? "demo" : "site");
  return (
    <div className="relative flex min-h-[420px] flex-1 flex-col">
      <div className="flex h-11 items-center gap-1 border-b border-line px-3">
        {(["demo", "site"] as const).map((x) => (
          <button key={x} disabled={x === "demo" && !Demo} onClick={() => setView(x)} className="press relative h-7 rounded-md px-2.5 text-[12.5px] text-fg2 disabled:opacity-40">
            {view === x && <motion.span layoutId="view" className="absolute inset-0 rounded-md bg-s3" transition={{ type: "spring", duration: 0.35, bounce: 0.1 }} />}
            <span className="relative">{x === "demo" ? "Live demo" : "Website"}</span>
          </button>
        ))}
        <span className="flex-1" />
        <a href={url} target="_blank" rel="noreferrer" className="press inline-flex items-center gap-1 text-[12.5px] text-fg2 hover:text-fg">Open site <ArrowUpRight size={13} /></a>
      </div>
      <div className="dots relative grid flex-1 place-items-center overflow-hidden p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            className="grid size-full place-items-center"
            initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            {view === "demo" && Demo ? <Demo /> : <img src={shot(id)} alt={`${name} website`} className="max-h-full w-full max-w-3xl rounded-xl object-cover object-top shadow-[0_0_0_1px_var(--color-line2),0_30px_80px_-30px_rgb(0_0_0/0.9)]" />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
