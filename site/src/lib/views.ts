// Client-side: one page view per page shown (POST /api/hit, from Base.astro on every astro:page-load), and the site's
// 30-day totals for islands that show them (GET /api/views). No cookie and no id: a browser flags itself as a visitor
// at most once per 30 days (a timestamp in localStorage), so "visitors" counts browsers, not people.
import { useEffect, useState } from "react";
import type { Views } from "../../../src/trending.ts";

const KEY = "tb-visited";
const MONTH = 30 * 24 * 60 * 60 * 1000;

export function countView() {
  let first = false;
  try {
    first = Date.now() - Number(localStorage.getItem(KEY) ?? 0) > MONTH;
    if (first) localStorage.setItem(KEY, String(Date.now()));
  } catch {} // storage blocked: the view still counts, the visitor does not
  fetch(`/api/hit${first ? "?new=1" : ""}`, { method: "POST", keepalive: true }).catch(() => {});
}

let pending: Promise<Partial<Views>> | undefined;
/** The totals once loaded; a stage without the read token (laptops) gets {} and shows nothing. */
export function useViews(): Partial<Views> | undefined {
  const [views, setViews] = useState<Partial<Views>>();
  useEffect(() => {
    pending ??= fetch("/api/views").then((r) => r.json() as Promise<Partial<Views>>).catch(() => ({}));
    pending.then(setViews);
  }, []);
  return views;
}
