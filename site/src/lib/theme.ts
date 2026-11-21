// Client-safe: dark (the default) or light. The choice lives in localStorage and on <html data-theme>; Base.astro's head
// script applies it before first paint and again after every client navigation, so there is no flash.
import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
export const THEME_KEY = "tb-theme";

const current = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
const subscribe = (fn: () => void) => (addEventListener("tb:theme", fn), () => removeEventListener("tb:theme", fn));

export const useTheme = () => useSyncExternalStore(subscribe, current, (): Theme => "dark");

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#ffffff" : "#000000");
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {} // private mode: the choice lasts for this page only
  dispatchEvent(new Event("tb:theme"));
}
