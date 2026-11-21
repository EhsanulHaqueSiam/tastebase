// Bombadil explores the site on its own (clicks, typing, scrolling, back, forward, reload) and checks these properties
// on every state it reaches, on top of its defaults: no HTTP errors, uncaught exceptions, rejected promises or console
// errors. Run with `pnpm bombadil <url>` (scripts/bombadil.sh): a desktop and a phone-sized pass.
import { always, eventually, extract, now } from "@antithesishq/bombadil";
export * from "@antithesishq/bombadil/browser/defaults";

const page = extract((s) => {
  const d = s.document;
  const named = (e: Element) => !!(e.textContent?.trim() || e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.getAttribute("title"));
  return {
    overflow: d.documentElement.scrollWidth > s.window.innerWidth + 1,
    title: d.title,
    h1s: d.querySelectorAll("h1").length,
    // A failed screenshot marked with data-fallback shows its fallback on purpose (ListingCard.tsx); others are broken.
    brokenImages: [...d.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !("fallback" in i.dataset)).map((i) => i.src).slice(0, 3),
    unnamedButtons: [...d.querySelectorAll("button, [role=button], a[href]")].filter((e) => !named(e) && !e.querySelector("img[alt]:not([alt=''])")).length,
    previewLoading: !!d.querySelector('iframe[title$="website"]') && !d.querySelector('iframe[title$="website"] ~ [aria-hidden="true"]'),
  };
});

/** Nothing on any screen makes the page scroll sideways, at desktop or phone width. */
export const noHorizontalScroll = always(() => !page.current.overflow);
/** Every page has a title and at most one top-level heading. */
export const titledWithOneHeading = always(() => page.current.title.length > 0 && page.current.h1s <= 1);
/** Images either load or show their designed fallback. */
export const noBrokenImages = always(() => page.current.brokenImages.length === 0);
/** Every button and link has a name a screen reader can announce. */
export const controlsHaveNames = always(() => page.current.unnamedButtons === 0);
/** A live preview never sits on its loading state for more than 15 seconds. */
export const previewFinishesLoading = always(now(() => page.current.previewLoading).implies(eventually(() => !page.current.previewLoading).within(15, "seconds")));
