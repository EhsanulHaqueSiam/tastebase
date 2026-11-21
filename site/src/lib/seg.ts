// Client-side: transitions.dev "Tabs sliding" for segmented controls (.seg). One pill per control sits under the
// aria-pressed button: it snaps there on first paint and on resize, and tweens when the pressed button changes.
// Astro-rendered controls get their pill from Base.astro's script; React islands render it with <Seg> (Seg.tsx), so
// nothing touches an island's DOM before React hydrates it.

function move(seg: HTMLElement, pill: HTMLElement, animate: boolean) {
  const on = seg.querySelector<HTMLElement>(':scope > button[aria-pressed="true"]');
  pill.style.opacity = on ? "1" : "0";
  if (!on) return;
  if (!animate) pill.style.transition = "none";
  Object.assign(pill.style, { transform: `translateX(${on.offsetLeft}px)`, width: `${on.offsetWidth}px` });
  if (!animate) void pill.offsetWidth, (pill.style.transition = "");
}

/** Keeps `pill` under the pressed button of `seg`. Returns the cleanup. */
export function trackSeg(seg: HTMLElement, pill: HTMLElement) {
  seg.dataset.pill = "";
  const frame = requestAnimationFrame(() => move(seg, pill, false));
  const mo = new MutationObserver(() => move(seg, pill, true));
  mo.observe(seg, { subtree: true, attributeFilter: ["aria-pressed"] });
  const onResize = () => move(seg, pill, false);
  addEventListener("resize", onResize);
  return () => (cancelAnimationFrame(frame), mo.disconnect(), removeEventListener("resize", onResize));
}
