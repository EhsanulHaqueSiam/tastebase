import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Command } from "cmdk";
import { Home, LayoutGrid, Search, TerminalSquare } from "lucide-react";
import { GithubMark } from "./GithubMark.tsx";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Dock } from "./Dock.tsx";
import { Toaster } from "sonner";
import { kindMeta, libraries } from "../data.ts";
import { LibMark } from "./LibMark.tsx";

export function Shell() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const dockActive = open ? "search" : "home";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") (e.preventDefault(), setOpen((o) => !o));
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        const ask = document.getElementById("ask");
        ask ? ask.focus() : setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-6 px-5">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-[-0.02em]">
          <motion.span whileHover={{ rotate: 90 }} transition={{ type: "spring", duration: 0.6, bounce: 0.3 }} className="size-[18px] rounded-md bg-[conic-gradient(from_200deg,var(--color-blue),var(--color-violet),var(--color-pink),var(--color-amber),var(--color-green),var(--color-cyan),var(--color-blue))]" />
          tastebase
        </Link>
        <nav className="hidden gap-5 text-fg2 sm:flex">
          <Link to="/browse" className="transition-colors hover:text-fg [&.active]:text-fg">Browse</Link>
          <a href="/#plan" className="transition-colors hover:text-fg">Plan</a>
          <a href="/#mcp" className="transition-colors hover:text-fg">MCP</a>
        </nav>
        <span className="flex-1" />
        <button onClick={() => setOpen(true)} aria-label="Search" className="press flex items-center gap-2 rounded-lg bg-white/5 p-2 text-[13px] text-fg2 shadow-[inset_0_0_0_1px_var(--color-line)] backdrop-blur-md hover:text-fg sm:py-1.5 sm:pr-1.5 sm:pl-3">
          <Search size={14} /> <span className="hidden sm:inline">Search</span> <span className="kbd hidden sm:inline">⌘K</span>
        </button>
        <a href="https://github.com/EhsanulHaqueSiam/tastebase" aria-label="GitHub" className="press text-fg2 hover:text-fg"><GithubMark size={18} /></a>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={path.split("/")[1] ?? ""}
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.25 }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>

      {/* Home only: on browse the panes already fill the screen. */}
      {path === "/" && (
        <Dock
          active={dockActive}
          items={[
            { id: "home", label: "Home", icon: Home, onSelect: () => (navigate({ to: "/" }), window.scrollTo({ top: 0, behavior: "smooth" })) },
            { id: "browse", label: "Browse", icon: LayoutGrid, onSelect: () => navigate({ to: "/browse" }) },
            { id: "search", label: "Search", icon: Search, hint: "⌘K", onSelect: () => setOpen(true) },
            { id: "mcp", label: "Add to Claude", icon: TerminalSquare, onSelect: () => document.getElementById("mcp")?.scrollIntoView({ behavior: "smooth" }) },
            { id: "github", label: "GitHub", icon: GithubMark, onSelect: () => window.open("https://github.com/EhsanulHaqueSiam/tastebase", "_blank", "noopener") },
          ]}
        />
      )}

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/60 px-4 pt-[16vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={() => setOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", duration: 0.3, bounce: 0.1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[560px]">
              <Command label="Search libraries" className="overflow-hidden rounded-2xl bg-s1 shadow-[0_0_0_1px_var(--color-line2),0_40px_100px_-20px_rgb(0_0_0/0.9)]">
                <div className="flex items-center gap-3 border-b border-line px-4"><Search size={16} className="text-fg3" /><Command.Input autoFocus placeholder="Search libraries, jobs, looks" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg3" /><span className="kbd">esc</span></div>
                <Command.List className="max-h-[360px] overflow-auto p-2">
                  <Command.Empty className="p-6 text-center text-fg3">Nothing found.</Command.Empty>
                  {Object.entries(kindMeta).map(([k, m]) => {
                    const libs = libraries.filter((l) => l.kind === k);
                    if (!libs.length) return null;
                    return (
                      <Command.Group key={k} heading={m.label} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-fg3">
                        {libs.map((l) => (
                          <Command.Item key={l.id} value={`${l.name} ${l.tagline} ${l.useFor.join(" ")}`} onSelect={() => (setOpen(false), navigate({ to: "/browse/$id", params: { id: l.id } }))} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 data-[selected=true]:bg-s3">
                            <LibMark lib={l} size={26} />
                            <span className="font-medium">{l.name}</span>
                            <span className="truncate text-[13px] text-fg2">{l.tagline}</span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    );
                  })}
                </Command.List>
              </Command>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "var(--color-s2)", border: "1px solid var(--color-line2)", color: "var(--color-fg)" } }} />
    </>
  );
}
