// Page prefetch that the ClientRouter actually uses. Astro's own prefetch adds <link rel="prefetch">, but our HTML is
// served max-age=0 with no validator, so the router's fetch on click downloaded the page again: every hover cost two
// downloads, and on a phone a tap's mouseenter started the second one alongside the navigation's. Here the prefetched
// HTML is kept in memory and handed to the router through its loader, and a navigation that starts while a prefetch is
// still in flight waits for that one instead of starting another.
import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

const FRESH = 5 * 60_000; // prerendered pages change only on deploy; live numbers load separately
// `doc`: the page already parsed, for pages warmed with `parse` (the phone tab bar's), so a tap only swaps. The router
// consumes a document, so it is parsed again in idle time after each use.
type Entry = { at: number; html: Promise<string | undefined>; doc?: Document; parse: boolean };
const pages = new Map<string, Entry>();
const idle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn) : setTimeout(fn, 200));
const parse = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("noscript").forEach((n) => n.remove());
  return doc;
};
const preparse = (e: Entry) => void e.html.then((h) => h && idle(() => (e.doc ??= parse(h))));

// A valid 1x1 GIF: swapping to it cancels a download without an error (an invalid one fired `error`, which shows a
// card its "no preview" fallback).
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const keyOf = (u: URL) => u.pathname + u.search;
const slow = () => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (!!c.saveData || /2g/.test(c.effectiveType ?? ""));
};

/** Fetches a same-origin page once into memory (kept for FRESH), and with `parse` parses it in idle time too. Not on
 * save-data or 2G. */
export function warm(href: string, parse = false) {
  const u = new URL(href, location.href);
  const key = keyOf(u);
  const had = pages.get(key);
  if (u.origin !== location.origin || key === keyOf(new URL(location.href)) || (had && Date.now() - had.at < FRESH) || slow()) return;
  // Normal priority: a click often lands while this is in flight, and the navigation then waits for it.
  const html = fetch(u)
    .then((r) => (r.ok && !r.redirected && r.headers.get("content-type")?.startsWith("text/html") ? r.text() : undefined))
    .catch(() => undefined);
  const entry: Entry = { at: Date.now(), html, parse };
  pages.set(key, entry);
  if (parse) preparse(entry);
}

const linkOf = (t: EventTarget | null) => {
  const a = (t as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
  return a && !a.target && !a.hasAttribute("download") && !a.hasAttribute("data-astro-reload") ? a : undefined;
};

/** Hover (a mouse resting 80ms) or keyboard focus warms a link; touch never does, a tap navigates at once anyway. */
export function startPrefetch() {
  let timer = 0;
  document.addEventListener("pointerover", (e) => {
    clearTimeout(timer);
    const a = e.pointerType === "mouse" ? linkOf(e.target) : undefined;
    if (a) timer = window.setTimeout(() => warm(a.href), 80);
  }, { passive: true });
  document.addEventListener("focusin", (e) => { const a = linkOf(e.target); if (a) warm(a.href); }, { passive: true });
  // Hand a warmed page to the router; anything unexpected falls back to its own loader.
  document.addEventListener("astro:before-preparation", (ev) => {
    const e = ev as TransitionBeforePreparationEvent;
    clearTimeout(timer); // a click within 80ms of the hover: the navigation fetches it, no prefetch after
    // The page is going away: stop its unfinished screenshots, so the next page's HTML gets the bandwidth (a phone
    // scrolled down a long grid has dozens in flight). Only in <main>, which is swapped; the shell persists.
    // A navigation that is cancelled or overtaken (a second click, an in-page #link) leaves this page up: put them back.
    // The attribute as written, not the resolved URL: an island hydrating later compares it with its own.
    const stopped = [...document.querySelectorAll<HTMLImageElement>("main img")].filter((i) => !i.complete).map((i) => [i, i.getAttribute("src")!] as const);
    for (const [i] of stopped) i.src = BLANK;
    e.signal.addEventListener("abort", () => stopped.forEach(([i, src]) => i.isConnected && i.setAttribute("src", src)), { once: true });
    const hit = !e.formData && pages.get(keyOf(e.to));
    if (!hit || Date.now() - hit.at >= FRESH) return;
    const fallback = e.loader;
    e.loader = async () => {
      const html = await hit.html;
      if (e.signal.aborted) return; // a newer navigation took over
      const doc = hit.doc ?? (html && parse(html));
      hit.doc = undefined;
      if (hit.parse) preparse(hit);
      if (!doc || !doc.querySelector('[name="astro-view-transitions-enabled"]')) return fallback();
      e.newDocument = doc; // stylesheets are inlined (astro.config), so there are none to preload
    };
  });
}
