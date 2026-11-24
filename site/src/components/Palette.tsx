// Global ⌘K palette and the toast host. Persisted across page transitions (transition:persist in Base.astro).
// Opens on ⌘K/Ctrl+K, on "/" when the page has no #ask input, on any [data-open-search] click, or on a "tb:search"
// event whose detail prefills the query (HeaderSearch.tsx). Phones get it as a bottom drawer (vaul) instead.
// With nothing typed it leads with a Browse group of the category pages, and on desktop its footer shows the keys.
import { navigate } from "astro:transitions/client";
import { Command } from "cmdk";
import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Toaster } from "sonner";
import { Drawer } from "vaul";
import { resourceKinds, type ResourceKind } from "../../../src/registry/resources.ts";
import type { Kind } from "../../../src/registry/schema.ts";
import { categories } from "../lib/categories.ts";
import { kindMeta, thumb } from "../lib/kinds.ts";
import { liveSponsors, sponsors } from "../lib/sponsors.ts";
import { withUtm } from "../lib/utm.ts";
import { useTheme } from "../lib/theme.ts";
import { ranked } from "../lib/search.ts";
import { LibMark } from "./LibMark.tsx";

type Row = { id: string; name: string; tagline: string; kind: Kind; search: string };
type Res = { id: string; name: string; goodFor: string; kind: ResourceKind; href: string };
type Look = { id: string; name: string; summary: string; accent: string; search: string };
type Lists = { libs: Row[]; looks: Look[]; resources: Res[] };
type Section = { id: string; heading: string; cap: number; weight?: number; rows: { id: string; name: string; text: string; sub: string; mark: ReactNode; href: string }[] };

const PHONE = "(max-width: 639px)";
const onPhoneChange = (fn: () => void) => {
  const mq = matchMedia(PHONE);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};

export default function Palette() {
  const phone = useSyncExternalStore(onPhoneChange, () => matchMedia(PHONE).matches, () => false);
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<Lists>();
  const [q, setQ] = useState("");
  useEffect(() => void (open || setQ("")), [open]);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => void list.current?.scrollTo(0, 0), [q]); // the best match is first; a scroll left from the last query hides it

  // What had focus when the palette opened (its input takes focus as it mounts) gets it back on close, unless a pick
  // started a navigation: the router fires astro:before-preparation inside navigate(), before this cleanup runs.
  const opener = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    // Reopened while closing, the panel animating out is reused and its input's autoFocus does not run again.
    document.querySelector<HTMLInputElement>("[data-palette] [cmdk-input]")?.focus();
    let leaving = false;
    const onLeave = () => (leaving = true);
    // Its input is the one control: Tab stays there, even after a click on the panel left focus on the page. Tied to
    // `open`, not to the panel, which stays mounted while it animates out.
    const onTab = (e: KeyboardEvent) => e.key === "Tab" && (e.preventDefault(), document.querySelector<HTMLInputElement>("[data-palette] [cmdk-input]")?.focus());
    document.addEventListener("astro:before-preparation", onLeave);
    window.addEventListener("keydown", onTab);
    return () => {
      document.removeEventListener("astro:before-preparation", onLeave);
      window.removeEventListener("keydown", onTab);
      const at = document.activeElement;
      if (!leaving && (at === document.body || at?.closest("[data-palette]")) && opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      // Nothing to go back to: leave the input as it animates out, so keys typed meanwhile do not land in it (and come
      // back as the next open's query).
      if (document.activeElement?.closest("[data-palette]")) (document.activeElement as HTMLElement).blur();
    };
  }, [open]);

  useEffect(() => {
    const remember = () => document.activeElement?.closest("[data-palette]") || (opener.current = document.activeElement as HTMLElement | null);
    const show = () => (remember(), setOpen(true));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") (e.preventDefault(), remember(), setOpen((o) => !o));
      else if (e.key === "Escape") setOpen(false);
      else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        const ask = document.getElementById("ask");
        ask ? ask.focus() : show();
      }
    };
    const onClick = (e: MouseEvent) => (e.target as Element).closest?.("[data-open-search]") && show();
    const onSearch = (e: Event) => (e instanceof CustomEvent && typeof e.detail === "string" && setQ(e.detail), show());
    window.addEventListener("keydown", onKey);
    window.addEventListener("tb:search", onSearch);
    document.addEventListener("click", onClick);
    return () => (window.removeEventListener("keydown", onKey), window.removeEventListener("tb:search", onSearch), document.removeEventListener("click", onClick));
  }, []);

  // Fetch the list the first time the palette opens, not on every page.
  useEffect(() => {
    if (open && !lists) fetch("/api/libs").then((r) => r.json() as Promise<Lists>).then(setLists).catch(() => setLists({ libs: [], looks: [], resources: [] }));
  }, [open, lists]);

  // The engine's picks for the query and the looks it names (what the home page shows), fetched as you type: a job in
  // words ("toast that stacks", "glassmorphism card") is something names and descriptions alone cannot rank.
  const [best, setBest] = useState<{ q: string; libs: string[]; looks: string[] }>();
  useEffect(() => {
    const t = q.trim();
    if (!open || !t) return;
    const ctl = new AbortController();
    const wait = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(t)}`, { signal: ctl.signal })
        .then((r) => r.json() as Promise<{ relevant: { id: string }[]; looks: string[] }>)
        .then((r) => setBest({ q: t, libs: r.relevant.slice(0, 5).map((l) => l.id), looks: r.looks }))
        .catch(() => {});
    }, 150);
    return () => (clearTimeout(wait), ctl.abort());
  }, [open, q]);

  const ads = open ? liveSponsors(sponsors) : []; // read when the palette opens, so an ended sponsor drops out
  const go = (href: string) => (setOpen(false), href.startsWith("/") ? navigate(href) : window.open(href, "_blank", "noopener"));
  const tile = (icon: ReactNode) => <span className="grid size-[26px] flex-none place-items-center rounded-md bg-s2 text-fg3">{icon}</span>;
  const sections: Section[] = !lists ? [] : [
    ...(q.trim() ? [] : [{ id: "browse", heading: "Browse", cap: Infinity, rows: [{ slug: "browse", label: "Libraries" }, ...categories].map((c) => ({ id: `browse:${c.slug}`, name: c.label, text: "", sub: "", mark: tile(<ArrowRight size={14} />), href: `/${c.slug}` })) }]),
    ...(ads.length ? [{ id: "sponsored", heading: "Sponsored", cap: Infinity, rows: ads.map((s) => ({ id: `ad:${s.id}`, name: s.name, text: `${s.description} sponsored`, sub: s.description, mark: <img src={thumb(s.image)} alt="" className="h-[26px] w-[46px] flex-none rounded-md object-cover" />, href: s.url.startsWith("/") ? s.url : withUtm(s.url, "palette") })) }] : []),
    ...Object.entries(kindMeta).map(([k, m]) => ({ id: k, heading: m.label, cap: 5, rows: lists.libs.filter((l) => l.kind === k).map((l) => ({ id: `lib:${l.id}`, name: l.name, text: `${l.tagline} ${l.search}`, sub: l.tagline, mark: <LibMark lib={l} size={26} />, href: `/browse/${l.id}` })) })),
    { id: "looks", heading: "Looks", cap: 3, rows: lists.looks.map((a) => ({ id: `look:${a.id}`, name: a.name, text: `${a.summary} ${a.search} look`, sub: a.summary, mark: tile(<span className="size-2.5 rounded-full" style={{ background: a.accent }} />), href: `/looks/${a.id}` })) },
    // What tastebase reviewed and does not recommend leads only on its name, never over a recommended match.
    ...Object.entries(resourceKinds).map(([k, label]) => ({ id: `res:${k}`, heading: `Resources · ${label}`, cap: 3, weight: k === "reviewed" ? 0.5 : 1, rows: lists.resources.filter((r) => r.kind === k).map((r) => ({ id: `res:${r.id}`, name: r.name, text: `${r.goodFor} ${label} resource`, sub: r.goodFor, mark: tile(<ArrowUpRight size={14} />), href: r.href })) })),
  ];
  // With nothing typed, each group shows its first few (the Browse group links to the full lists): mounting all 900+
  // entries made opening the palette cost ~300ms on a slow phone. Typing ranks them all (lib/search.ts).
  const rowsById = new Map(sections.flatMap((s) => s.rows.map((r) => [r.id, r] as const)));
  // Picks for an earlier, shorter query stay up while the next ones load, so the list does not jump on every key.
  const fresh = best && q.trim().toLowerCase().startsWith(best.q.toLowerCase());
  const fit = fresh ? [...best.looks.map((id) => `look:${id}`), ...best.libs.map((id) => `lib:${id}`)].flatMap((id) => rowsById.get(id) ?? []) : [];
  const taken = new Set(fit.map((r) => r.id));
  const shown = [
    ...(fit.length ? [{ id: "fit", heading: "Best fit", cap: Infinity, rows: fit }] : []),
    ...ranked(sections.map((s) => ({ ...s, rows: s.rows.filter((r) => !taken.has(r.id)) })).filter((s) => s.rows.length), q).map((s) => (q.trim() ? s : { ...s, rows: s.rows.slice(0, s.cap) })),
  ];
  // cmdk selects the first row as the query changes; Best fit lands above it a moment later, so select its first.
  const [selected, setSelected] = useState("");
  const firstFit = fit[0]?.id;
  useEffect(() => void (firstFit && setSelected(firstFit)), [firstFit]);
  const heading = "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-fg3";

  const panel = (
    <Command data-palette label="Search libraries" shouldFilter={false} value={selected} onValueChange={setSelected} className={phone ? "flex min-h-0 flex-col" : "overflow-hidden rounded-2xl bg-s1 shadow-[0_0_0_1px_var(--color-line2),0_40px_100px_-20px_rgb(0_0_0/0.9)]"}>
      <div className="flex items-center gap-3 border-b border-line px-4"><Search size={16} className="text-fg3" /><Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Search libraries, jobs, looks, resources" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg3" /><span className="kbd">esc</span></div>
      <Command.List ref={list} className="max-h-[360px] overflow-auto p-2">
        {lists ? <Command.Empty className="p-6 text-center text-fg3">Nothing found.</Command.Empty> : <Command.Loading><div className="p-6 text-center text-fg3">Loading</div></Command.Loading>}
        {shown.map((s) => (
          <Command.Group key={s.id} heading={s.heading} className={heading}>
            {s.rows.map((r) => (
              <Command.Item key={r.id} value={r.id} onSelect={() => go(r.href)} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 data-[selected=true]:bg-s3">
                {r.mark}
                <span className="shrink-0 font-medium">{r.name}</span>
                {r.sub && <span className="truncate text-[13px] text-fg2">{r.sub}</span>}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
      {!phone && (
        <footer className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12px] text-fg3">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> to move</span>
          <span><span className="kbd">↵</span> to open · <span className="kbd">esc</span> to close</span>
        </footer>
      )}
    </Command>
  );

  return (
    <>
      <AnimatePresence>
        {open && !phone && (
          <motion.div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/60 px-4 pt-[16vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={() => setOpen(false)}>
            <motion.div role="dialog" aria-modal="true" aria-label="Search" initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", duration: 0.3, bounce: 0.1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[560px]">
              {panel}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Drawer.Root open={open && phone} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
          <Drawer.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88svh] flex-col rounded-t-[24px] bg-s1 pb-[env(safe-area-inset-bottom)] shadow-[0_0_0_1px_var(--color-line2)] outline-none [&_[cmdk-list]]:max-h-[60svh]">
            <Drawer.Title className="sr-only">Search</Drawer.Title>
            <div className="mx-auto mt-2 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-s3" aria-hidden />
            {panel}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
      <Toaster theme={theme} position="bottom-right" mobileOffset={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }} toastOptions={{ style: { background: "var(--color-s2)", border: "1px solid var(--color-line2)", color: "var(--color-fg)" } }} />
    </>
  );
}
