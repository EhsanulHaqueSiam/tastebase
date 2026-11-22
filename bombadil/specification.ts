// Bombadil explores the site on its own (clicks, typing, scrolling, back, forward, reload) and checks these properties
// on every state it reaches, on top of its defaults: no HTTP errors, uncaught exceptions, rejected promises or console
// errors. Run with `pnpm bombadil <url>` (scripts/bombadil.sh): a desktop and a phone-sized pass.
import { always, eventually, now } from "@antithesishq/bombadil";
import { extract } from "@antithesishq/bombadil/browser";
export * from "@antithesishq/bombadil/browser/defaults";

// Whether an element cannot widen the page: a scrolling, clipping or fixed ancestor holds it.
const escapes = (e: Element) => {
  for (let p = e.parentElement; p && p !== e.ownerDocument.body; p = p.parentElement) {
    const c = p.ownerDocument.defaultView!.getComputedStyle(p);
    if (c.overflowX !== "visible" || c.position === "fixed") return true;
  }
  return false;
};

const page = extract((s) => {
  const d = s.document;
  // Our own pages only: exploration can follow a link out (GitHub, a library's site) and their markup is not ours.
  // HTML only: /llms.txt and the .md copies are plain text for agents, with no title or heading by design.
  const ours = /tastebase|localhost/.test(s.window.location.host) && d.contentType === "text/html";
  const named = (e: Element) => !!(e.textContent?.trim() || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.getAttribute("title"));
  return {
    ours,
    // Not mid page swap: Chrome sizes a view transition's snapshot over the scrollbar gutter, so scrollWidth reads a
    // classic scrollbar's width too wide until it ends, though nothing on the page moved.
    overflow: ours && !d.documentElement.hasAttribute("data-astro-transition") && d.documentElement.scrollWidth > d.documentElement.clientWidth + 1,
    // Only when it overflows: what sticks out, so a violation names the culprit.
    wide: ours && !d.documentElement.hasAttribute("data-astro-transition") && d.documentElement.scrollWidth > d.documentElement.clientWidth + 1
      ? [...d.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > d.documentElement.clientWidth + 1 && !escapes(e)).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.getAttribute("class")).slice(0, 80)}`)
      : [],
    path: s.window.location.pathname + s.window.location.search,
    title: d.title,
    h1s: d.querySelectorAll("h1").length,
    // A failed screenshot marked with data-fallback shows its fallback on purpose (ListingCard.tsx); others are broken.
    brokenImages: [...d.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !("fallback" in i.dataset)).map((i) => i.src).slice(0, 3),
    unnamedButtons: [...d.querySelectorAll("button, [role=button], a[href]")].filter((e) => !named(e) && !e.querySelector("img[alt]:not([alt=''])")).length,
    // /browse from lg up: the job list's left edge against the page's (the nav rail's) and the sheet's box, in px.
    jobsOffset: (() => {
      const aside = d.querySelector("aside[aria-label=Jobs]"), main = d.querySelector("main");
      if (!aside || !main || s.window.innerWidth < 1024) return 0;
      return aside.getBoundingClientRect().left - main.getBoundingClientRect().left - parseFloat(s.window.getComputedStyle(main).paddingLeft);
    })(),
    sheetOut: (() => {
      const r = d.querySelector("[role=dialog][aria-label=Library]")?.getBoundingClientRect();
      return !!r && (r.left < 0 || r.right > s.window.innerWidth);
    })(),
    previewLoading: !!d.querySelector('iframe[title$="website"]') && !d.querySelector('iframe[title$="website"] ~ [aria-hidden="true"]'),
  };
});

/** Nothing on any screen makes the page scroll sideways, at desktop or phone width. */
export const noHorizontalScroll = always(() => !page.current.overflow);
/** Every page has a title and at most one top-level heading. */
export const titledWithOneHeading = always(() => !page.current.ours || (page.current.title.length > 0 && page.current.h1s <= 1));
/** Images either load or show their designed fallback. */
export const noBrokenImages = always(() => !page.current.ours || page.current.brokenImages.length === 0);
/** Every button and link has a name a screen reader can announce. */
export const controlsHaveNames = always(() => !page.current.ours || page.current.unnamedButtons === 0);
/** /browse's job list sits against the nav rail at every width, folded beside the sheet or not (it once floated
 *  hundreds of px away on wide screens, with the sheet beside it). */
export const jobsAgainstRail = always(() => Math.abs(page.current.jobsOffset) < 2);
/** The library sheet stays inside the window. */
export const sheetInsideWindow = always(() => !page.current.sheetOut);
/** A live preview never sits on its loading state: LiveSite.tsx gives up at 12 seconds and shows the screenshot, so
 *  anything past 13 means that fallback broke. How fast it loads is pnpm bench's job. */
export const previewFinishesLoading = always(now(() => page.current.previewLoading).implies(eventually(() => !page.current.previewLoading).within(13, "seconds")));
