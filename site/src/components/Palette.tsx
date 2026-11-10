// Global ⌘K palette and the toast host. Persisted across page transitions (transition:persist in Base.astro).
// Opens on ⌘K/Ctrl+K, on "/" when the page has no #ask input, or on any [data-open-search] click.
import { navigate } from "astro:transitions/client";
import { Command } from "cmdk";
import { ArrowUpRight, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { resourceKinds, type ResourceKind } from "../../../src/registry/resources.ts";
import type { Kind } from "../../../src/registry/schema.ts";
import { kindMeta } from "../lib/kinds.ts";
import { LibMark } from "./LibMark.tsx";

type Row = { id: string; name: string; tagline: string; kind: Kind; search: string };
type Res = { id: string; name: string; goodFor: string; kind: ResourceKind; url: string };
type Lists = { libs: Row[]; resources: Res[] };

export default function Palette() {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<Lists>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") (e.preventDefault(), setOpen((o) => !o));
      else if (e.key === "Escape") setOpen(false);
      else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        const ask = document.getElementById("ask");
        ask ? ask.focus() : setOpen(true);
      }
    };
    const onClick = (e: MouseEvent) => (e.target as Element).closest?.("[data-open-search]") && setOpen(true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => (window.removeEventListener("keydown", onKey), document.removeEventListener("click", onClick));
  }, []);

  // Fetch the list the first time the palette opens, not on every page.
  useEffect(() => {
    if (open && !lists) fetch("/api/libs").then((r) => r.json() as Promise<Lists>).then(setLists).catch(() => setLists({ libs: [], resources: [] }));
  }, [open, lists]);

  const groups = Object.entries(kindMeta).map(([k, m]) => [m.label, (lists?.libs ?? []).filter((r) => r.kind === k)] as const).filter(([, list]) => list.length);
  // Resources are linked, not browsed here, so they open the site in a new tab.
  const resGroups = Object.entries(resourceKinds).map(([k, label]) => [label, (lists?.resources ?? []).filter((r) => r.kind === k)] as const).filter(([, list]) => list.length);
  const heading = "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-fg3";

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/60 px-4 pt-[16vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={() => setOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", duration: 0.3, bounce: 0.1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[560px]">
              <Command label="Search libraries" className="overflow-hidden rounded-2xl bg-s1 shadow-[0_0_0_1px_var(--color-line2),0_40px_100px_-20px_rgb(0_0_0/0.9)]">
                <div className="flex items-center gap-3 border-b border-line px-4"><Search size={16} className="text-fg3" /><Command.Input autoFocus placeholder="Search libraries, jobs, looks, resources" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg3" /><span className="kbd">esc</span></div>
                <Command.List className="max-h-[360px] overflow-auto p-2">
                  {lists ? <Command.Empty className="p-6 text-center text-fg3">Nothing found.</Command.Empty> : <Command.Loading><div className="p-6 text-center text-fg3">Loading</div></Command.Loading>}
                  {groups.map(([label, list]) => (
                    <Command.Group key={label} heading={label} className={heading}>
                      {list.map((l) => (
                        <Command.Item key={l.id} value={`${l.name} ${l.tagline} ${l.search}`} onSelect={() => (setOpen(false), navigate(`/browse/${l.id}`))} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 data-[selected=true]:bg-s3">
                          <LibMark lib={l} size={26} />
                          <span className="font-medium">{l.name}</span>
                          <span className="truncate text-[13px] text-fg2">{l.tagline}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))}
                  {resGroups.map(([label, list]) => (
                    <Command.Group key={label} heading={`Resources · ${label}`} className={heading}>
                      {list.map((r) => (
                        <Command.Item key={r.id} value={`${r.name} ${r.goodFor} ${label} resource`} onSelect={() => (setOpen(false), window.open(r.url, "_blank", "noopener"))} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 data-[selected=true]:bg-s3">
                          <span className="grid size-[26px] flex-none place-items-center rounded-md bg-s2 text-fg3"><ArrowUpRight size={14} /></span>
                          <span className="font-medium">{r.name}</span>
                          <span className="truncate text-[13px] text-fg2">{r.goodFor}</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))}
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
