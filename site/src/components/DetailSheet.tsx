// /browse on desktop: a library card opens its page in a sheet over the grid instead of leaving the directory (after
// Pinterest and Zillow). The sheet frames the real detail page, which drops the site's chrome when framed (Base.astro),
// so the two never drift. The URL follows the sheet (/browse/<id>, so it can be copied, shared or reloaded into the full
// page). ×, Esc, the dimmed grid and Back close it onto the same grid and scroll; a press on the job list or header
// closes it too, then does what it was pressed for. Phones and modified clicks navigate as before.
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

const DESKTOP = "(min-width: 1024px)";
type State = { sheet?: string } | null;

/** `scope`: the results area. Its library links open the sheet; the sheet and its dimmed backdrop cover it. */
export default function DetailSheet({ scope }: { scope: RefObject<HTMLElement | null> }) {
  const [path, setPath] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const origin = useRef<{ url: string; state: unknown }>({ url: "", state: null });
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  // Back from the sheet's entry, or the × / Esc / backdrop (which step back to it).
  const close = () => ((history.state as State)?.sheet ? history.back() : setPath(null));
  // A press elsewhere (job list, header) must not wait for Back: the click it starts may rewrite the URL (?job=).
  const closeNow = () => (history.replaceState(origin.current.state, "", origin.current.url), setPath(null));

  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !matchMedia(DESKTOP).matches) return;
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="/browse/"]');
      if (!a || a.target) return;
      e.preventDefault();
      origin.current = { url: location.href, state: history.state };
      history.pushState({ ...(history.state as object), sheet: a.pathname }, "", a.pathname);
      setLeft(el.getBoundingClientRect().left);
      setPath(a.pathname);
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [scope]);

  // Back out of the sheet or Forward into it, handed over by Base.astro's popstate listener (ahead of the router's).
  useEffect(() => {
    const onStep = (e: Event) => {
      const sheet = (e as CustomEvent<string | null>).detail;
      if (sheet && scope.current) setLeft(scope.current.getBoundingClientRect().left);
      setPath(sheet && matchMedia(DESKTOP).matches ? sheet : null);
    };
    addEventListener("tb:sheet", onStep);
    return () => removeEventListener("tb:sheet", onStep);
  }, [scope]);

  // Before paint: data-sheet folds the job list (Directory.tsx), so the sheet's left edge is measured after it.
  useLayoutEffect(() => {
    if (!path) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && !(e.target as Element).closest("[data-sheet-backdrop]") && closeNow();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    const root = document.documentElement;
    root.style.overflow = "hidden"; // the grid stays put under the sheet
    root.setAttribute("data-sheet", "");
    if (scope.current) setLeft(scope.current.getBoundingClientRect().left);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
      root.style.overflow = "";
      root.removeAttribute("data-sheet");
    };
  }, [path]);

  // Each page the frame loads: Esc closes from inside it too, and the URL follows it. Its own links replace the framed
  // page rather than navigate it, since a frame's navigations join the tab's history and × would then step back
  // through them. A link off the detail pages (a look, an article) takes the whole tab there.
  const onLoad = () => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    const p = win.location.pathname;
    if (!win.document.querySelector("[data-detail]")) return closeNow(), location.assign(win.location.href);
    if (p !== location.pathname) history.replaceState({ ...(history.state as object), sheet: p }, "", p);
    win.addEventListener("keydown", (e) => e.key === "Escape" && close());
    win.document.addEventListener(
      "click",
      (e) => {
        const a = (e.target as Element).closest?.<HTMLAnchorElement>("a[href]");
        if (!a || a.target || a.origin !== location.origin || a.pathname === p || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        win.location.replace(a.href);
      },
      true,
    );
    frame.current?.focus();
  };

  if (!path) return null;
  return (
    <>
      <div data-sheet-backdrop onClick={close} aria-hidden className="fixed top-14 right-0 bottom-0 z-40 bg-black/60 [animation:fade-in_200ms_var(--ease-out)]" style={{ left }} />
      <div ref={box} role="dialog" aria-modal="true" aria-label="Library" className="fixed top-16 right-16 bottom-3 z-50 [animation:sheet-in_240ms_var(--ease-out)]" style={{ left: left + 16 }}>
        <iframe ref={frame} key={path} src={path} title="Library details" onLoad={onLoad} className="size-full rounded-2xl bg-bg shadow-[0_0_0_1px_var(--color-line2),0_30px_80px_-20px_rgb(0_0_0/0.9)]" />
        <button type="button" onClick={close} aria-label="Close" title="Close (Esc)" className="press absolute top-0 -right-12 grid size-9 place-items-center rounded-[10px] bg-s2 text-fg2 shadow-[inset_0_0_0_1px_var(--color-line2)] hover:text-fg">
          <X size={18} />
        </button>
      </div>
    </>
  );
}
