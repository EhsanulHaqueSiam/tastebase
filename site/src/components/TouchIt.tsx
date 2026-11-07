import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { demos } from "./Demos.tsx";
import { Rise, SpotCard } from "./fx.tsx";

const TOUCH: [string, string, string][] = [
  ["torph", "Text that morphs", "Torph"],
  ["number-flow", "Numbers that roll", "NumberFlow"],
  ["glisse", "Liquid glass", "Glisse"],
  ["motion", "Springs you can throw", "Motion"],
  ["lucide", "Icons that morph", "Lucide + Motion"],
  ["sonner", "Toasts that stack", "Sonner"],
  ["cmdk", "Command menus", "cmdk"],
  ["vaul", "Drawers you can fling", "Vaul"],
];

export default function TouchIt() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <Rise>
        <h2 className="text-[clamp(28px,3.6vw,44px)] leading-tight font-semibold tracking-[-0.035em]">Touch it before you install it.</h2>
        <p className="mt-2 max-w-[56ch] text-[15px] text-fg2">Every demo below runs on the real library. Tap, drag, flick.</p>
      </Rise>
      <div className="mt-10 grid auto-rows-[260px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOUCH.map(([id, title, lib], i) => {
          const Demo = demos[id];
          if (!Demo) return null;
          return (
            <Rise key={id} delay={i * 0.06} className={i === 2 ? "lg:row-span-2" : ""}>
              <SpotCard className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-s1 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <div className="dots relative grid flex-1 place-items-center overflow-hidden">{<Demo />}</div>
                <Link to="/browse/$id" params={{ id }} className="group flex items-center justify-between border-t border-line px-4 py-3">
                  <span><span className="font-medium">{title}</span> <span className="text-fg3">· {lib}</span></span>
                  <ArrowUpRight size={15} className="text-fg3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg" />
                </Link>
              </SpotCard>
            </Rise>
          );
        })}
      </div>
    </section>
  );
}

