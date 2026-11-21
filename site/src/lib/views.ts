// Client-side: page views (countView, from Base.astro on every astro:page-load), sent as one POST /api/hit?n=<views>
// when the tab is hidden or closed, and the site's 30-day totals for islands that show them (GET /api/views). One
// Worker request per visit instead of per page keeps the free plan's daily requests for the API and MCP.
// No cookie and no id: a browser flags itself as a visitor at most once per 30 days (a timestamp in localStorage),
// so "visitors" counts browsers, not people.
import { useEffect, useState } from "react";
import type { Views } from "../../../src/trending.ts";

const KEY = "tb-visited";
const MONTH = 30 * 24 * 60 * 60 * 1000;
let unsent = 0, firstVisit = false, armed = false;

export function countView() {
  unsent++;
  try {
    if (Date.now() - Number(localStorage.getItem(KEY) ?? 0) > MONTH) (firstVisit = true), localStorage.setItem(KEY, String(Date.now()));
  } catch {} // storage blocked: the view still counts, the visitor does not
  if (armed) return;
  armed = true;
  addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  addEventListener("pagehide", flush);
}

/** Sends the views counted since the last send; sendBeacon survives the page closing. */
function flush() {
  if (!unsent) return;
  const url = `/api/hit?n=${unsent}${firstVisit ? "&new=1" : ""}`;
  unsent = 0;
  firstVisit = false;
  if (!navigator.sendBeacon?.(url)) fetch(url, { method: "POST", keepalive: true }).catch(() => {});
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
