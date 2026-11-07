// Floating dock in the designindex style: near-black pill, icon buttons, a spring pill marks the active item.
import { navigate } from "astro:transitions/client";
import { Home, LayoutGrid, Search, TerminalSquare, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { GithubMark } from "./GithubMark.tsx";

type Item = { id: string; label: string; icon: LucideIcon | typeof GithubMark; hint?: string; onSelect: () => void };

const ITEMS: Item[] = [
  { id: "home", label: "Home", icon: Home, onSelect: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
  { id: "browse", label: "Browse", icon: LayoutGrid, onSelect: () => navigate("/browse") },
  { id: "search", label: "Search", icon: Search, hint: "⌘K", onSelect: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })) },
  { id: "mcp", label: "Add to Claude", icon: TerminalSquare, onSelect: () => document.getElementById("mcp")?.scrollIntoView({ behavior: "smooth" }) },
  { id: "github", label: "GitHub", icon: GithubMark, onSelect: () => window.open("https://github.com/EhsanulHaqueSiam/tastebase", "_blank", "noopener") },
];

export default function Dock({ active = "home", items = ITEMS }: { active?: string; items?: Item[] }) {
  const [hover, setHover] = useState<string>();
  return (
    <motion.nav
      aria-label="Quick actions"
      initial={{ y: 24, opacity: 0, filter: "blur(6px)" }}
      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", duration: 0.6, bounce: 0.2, delay: 0.4 }}
      className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl bg-[#0e0e10]/85 p-1.5 shadow-[0_0_0_1px_var(--color-line2),0_16px_40px_-12px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-xl"
      onPointerLeave={() => setHover(undefined)}
    >
      {items.map((it, i) => {
        const on = it.id === active;
        return (
          <span key={it.id} className="contents">
            {i === items.length - 1 && <span className="mx-1 h-5 w-px bg-line2" aria-hidden />}
            <button
              onClick={it.onSelect}
              onPointerEnter={() => setHover(it.id)}
              onFocus={() => setHover(it.id)}
              onBlur={() => setHover(undefined)}
              aria-label={it.label}
              aria-current={on ? "page" : undefined}
              className={`press relative grid size-10 place-items-center rounded-xl transition-colors ${on ? "text-fg" : "text-fg3 hover:text-fg"}`}
            >
              {on && <motion.span layoutId="dock-active" className="absolute inset-0 rounded-xl bg-s3 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]" transition={{ type: "spring", duration: 0.45, bounce: 0.2 }} />}
              <motion.span className="relative" animate={{ scale: hover === it.id ? 1.12 : 1 }} transition={{ type: "spring", duration: 0.3, bounce: 0.4 }}>
                <it.icon size={17} />
              </motion.span>
              <AnimatePresence>
                {hover === it.id && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 2, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                    className="pointer-events-none absolute bottom-full mb-2.5 flex items-center gap-1.5 rounded-lg bg-s2 px-2 py-1 text-[12px] whitespace-nowrap text-fg shadow-[0_0_0_1px_var(--color-line2)]"
                  >
                    {it.label}
                    {it.hint && <span className="kbd">{it.hint}</span>}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </span>
        );
      })}
    </motion.nav>
  );
}

