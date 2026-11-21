// Client-side, and free of React so the page script in Base.astro can import it.
/** The sidebar button and ⌘B: hides or shows the desktop rail (remembered across pages, Base.astro applies it before
 *  first paint), and opens the More sheet (TabBar.tsx) below lg, where there is no rail. */
export function toggleNav() {
  if (!matchMedia("(min-width: 1024px)").matches) return void dispatchEvent(new Event("tb:more"));
  const hidden = document.documentElement.toggleAttribute("data-rail-hidden");
  try {
    hidden ? localStorage.setItem("tb-rail", "hidden") : localStorage.removeItem("tb-rail");
  } catch {} // private mode: hidden for this page only
}
