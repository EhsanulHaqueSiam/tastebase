// Browser benchmark: loads every kind of page cold on desktop and on a throttled phone, then clicks, types and switches
// tabs the way a visitor does, and scores each 0-10 with Lighthouse's own scoring curves.
//   pnpm bench https://tastebase-pr-54.ehsanulsiam.workers.dev            all pages, 3 runs each (median)
//   pnpm bench http://localhost:1337 --runs 1 --only atlas,browse-gsap      a subset, fast
// Writes bench-results/<date>.json and prints a table. Exits 1 when any score is under --min (default 9.5).
import { mkdirSync, writeFileSync } from "node:fs";
import { withChrome, type Tab } from "./cdp.ts";

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:1337").replace(/\/$/, "");
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const runs = Number(flag("runs") ?? 3);
const min = Number(flag("min") ?? 9.5);
const only = flag("only")?.split(",");

// One page of each kind, plus the pages with the most behaviour. `live` marks a detail page whose preview panel loads.
const pages: { name: string; path: string; live?: boolean }[] = [
  { name: "home", path: "/" },
  { name: "browse", path: "/browse" },
  { name: "browse-vaul", path: "/browse/vaul", live: true },
  { name: "browse-gsap", path: "/browse/gsap", live: true },
  { name: "browse-shadcn", path: "/browse/shadcn-ui", live: true },
  { name: "atlas", path: "/atlas" },
  { name: "looks", path: "/looks" },
  { name: "components", path: "/components" },
  { name: "tools", path: "/tools" },
  { name: "fonts", path: "/fonts" },
  { name: "tool-detail", path: "/tools/figma" },
  { name: "alternatives", path: "/alternatives" },
  { name: "alternatives-detail", path: "/alternatives/recharts-alternatives" },
  { name: "best", path: "/best" },
  { name: "integrations", path: "/integrations" },
  { name: "match", path: "/match" },
  { name: "folders", path: "/folders" },
  { name: "about", path: "/about" },
  { name: "submit", path: "/submit" },
  { name: "not-found", path: "/no-such-page" },
].filter((p) => !only || only.includes(p.name));

// Lighthouse 12 scoring curves: [p10, median] per metric (score 0.9 at p10, 0.5 at the median), and the weights.
const curves = {
  desktop: { fcp: [934, 1600], lcp: [1200, 2400], tbt: [150, 350], cls: [0.1, 0.25], ttfb: [800, 1800] },
  mobile: { fcp: [1800, 3000], lcp: [2500, 4000], tbt: [200, 600], cls: [0.1, 0.25], ttfb: [800, 1800] },
} as const;
const weights = { fcp: 0.1, lcp: 0.25, tbt: 0.3, cls: 0.25, ttfb: 0.1 } as const;
const inpCurve = [200, 500] as const;

// erf by Abramowitz-Stegun 7.1.26, close enough for scoring.
function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return Math.sign(x) * y;
}
/** Lighthouse's log-normal score, 0..1. */
function logNormal(value: number, [p10, median]: readonly [number, number]) {
  if (value <= 0) return 1;
  const sigma = Math.log(median / p10) / (Math.SQRT2 * 0.9061938024368232);
  const z = (Math.log(value) - Math.log(median)) / (Math.SQRT2 * sigma);
  return Math.min(1, Math.max(0, (1 - erf(z)) / 2));
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// Runs in the page before any of its scripts: collects paint, layout shift, long task and interaction timings.
const OBSERVE = `(() => {
  const m = window.__bench = { fcp: 0, lcp: 0, cls: 0, longTasks: [], events: [], navs: [], errors: [] };
  const po = (type, fn, opts = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true, ...opts }); } catch {} };
  po("paint", (e) => { if (e.name === "first-contentful-paint") m.fcp = e.startTime; });
  po("largest-contentful-paint", (e) => { m.lcp = e.startTime; const el = e.element; m.lcpEl = el ? el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "") + (e.url ? " " + e.url.split("/").pop() : "") : ""; });
  po("layout-shift", (e) => { if (!e.hadRecentInput) m.cls += e.value; });
  po("longtask", (e) => m.longTasks.push([e.startTime, e.duration]));
  po("event", (e) => { if (e.interactionId) m.events.push([e.name, e.duration, e.startTime]); }, { durationThreshold: 16 });
  document.addEventListener("astro:page-load", () => m.navs.push(performance.now()));
  addEventListener("error", (e) => m.errors.push(String(e.message || e.target?.src || e.type)), true);
})();`;

type Interaction = { name: string; inp: number; ms?: number; note?: string };
type Result = {
  page: string; profile: "desktop" | "mobile";
  ttfb: number; fcp: number; lcp: number; cls: number; tbt: number;
  transferKB: number; jsKB: number; requests: number; domNodes: number; lcpEl: string;
  loadScore: number; interactions: Interaction[]; interactionScore: number;
  overflow: boolean; consoleErrors: string[]; failed: string[]; uncached: string[];
  liveMs?: number; live?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const evaluate = async <T,>(tab: Tab, expression: string): Promise<T> =>
  (await tab.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value as T;

/** Waits until no request has been in flight for `quietMs`, or `maxMs` passes. */
async function networkIdle(inflight: () => number, quietMs = 600, maxMs = 15_000) {
  const end = Date.now() + maxMs;
  let quietSince = Date.now();
  while (Date.now() < end) {
    if (inflight() > 0) quietSince = Date.now();
    else if (Date.now() - quietSince >= quietMs) return;
    await sleep(100);
  }
}

/** Clicks the centre of the first visible element matching `selector` (skipping `skip` matches) with real input events. */
async function click(tab: Tab, selector: string, index = 0) {
  const box = await evaluate<{ x: number; y: number; label: string } | null>(tab, `(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; });
    const el = els[${index}]; if (!el) return null;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 32) };
  })()`);
  if (!box) return null;
  // A visitor sees a control before clicking it: a second after it scrolls in, not the instant it appears.
  await sleep(1000);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"] as const)
    await tab.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: type === "mouseMoved" ? 0 : 1 });
  return box.label;
}

async function key(tab: Tab, k: string, modifiers = 0) {
  const code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
  await tab.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, modifiers, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : k === "Escape" ? 27 : 13, text: modifiers ? undefined : k.length === 1 ? k : undefined });
  await tab.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers });
}

/** The slowest interaction since `from` events were recorded, in ms (the INP of that step). */
async function slowestSince(tab: Tab, from: number) {
  await sleep(700);
  const events = await evaluate<[string, number][]>(tab, "window.__bench.events");
  return Math.max(0, ...events.slice(from).map((e) => e[1]));
}
const eventCount = (tab: Tab) => evaluate<number>(tab, "window.__bench.events.length");

async function measure(openTab: () => Promise<Tab>, page: (typeof pages)[number], profile: "desktop" | "mobile"): Promise<Result> {
  const tab = await openTab();
  const mobile = profile === "mobile";
  const consoleErrors: string[] = [], failed: string[] = [], uncached: string[] = [];
  let inflight = 0, transfer = 0, js = 0, requests = 0, ttfb = 0;
  const types = new Map<string, string>();
  tab.on("Network.requestWillBeSent", () => (inflight++, requests++));
  tab.on("Network.responseReceived", (p) => {
    types.set(p.requestId, p.type);
    const r = p.response;
    if (p.type === "Document" && !ttfb && r.timing) ttfb = r.timing.receiveHeadersEnd;
    // The 404 page answering 404 is correct; anything else at 400+ is not.
    if (r.status >= 400 && !/favicon/.test(r.url) && !(p.type === "Document" && page.name === "not-found" && r.status === 404)) failed.push(`${r.status} ${r.url}`);
    const cc = String(Object.entries(r.headers).find(([k]) => k.toLowerCase() === "cache-control")?.[1] ?? "");
    if (/\/_astro\//.test(r.url) && !/immutable|max-age=(3\d{6,}|[4-9]\d{6,}|\d{8,})/.test(cc)) uncached.push(r.url.replace(base, ""));
  });
  tab.on("Network.loadingFinished", (p) => { inflight = Math.max(0, inflight - 1); transfer += p.encodedDataLength; if (types.get(p.requestId) === "Script") js += p.encodedDataLength; });
  tab.on("Network.loadingFailed", (p) => { inflight = Math.max(0, inflight - 1); if (!p.canceled && p.errorText !== "net::ERR_ABORTED") failed.push(`${p.errorText} ${p.requestId}`); });
  tab.on("Runtime.exceptionThrown", (p) => consoleErrors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).split("\n")[0]!));
  tab.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") consoleErrors.push(p.args.map((a: { value?: unknown; description?: string }) => a.value ?? a.description).join(" ").slice(0, 200)); });
  try {
    await tab.send("Network.enable");
    await tab.send("Runtime.enable");
    await tab.send("Page.enable");
    await tab.send("Network.setCacheDisabled", { cacheDisabled: true });
    await tab.send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
    await tab.send("Emulation.setDeviceMetricsOverride", mobile ? { width: 390, height: 844, deviceScaleFactor: 3, mobile: true } : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    if (mobile) {
      await tab.send("Emulation.setTouchEmulationEnabled", { enabled: true });
      await tab.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await tab.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    }
    await tab.send("Page.navigate", { url: base + page.path });
    await networkIdle(() => inflight);
    await sleep(1500);
    const m = await evaluate<{ fcp: number; lcp: number; cls: number; lcpEl: string; longTasks: [number, number][] }>(tab, "window.__bench");
    // Page weight as loaded, before the clicks below add their own requests and hover prefetches.
    const loaded = { transfer, js, requests };
    // Total blocking time between first paint and now, as Lighthouse counts it.
    const tbt = m.longTasks.filter(([s]) => s >= m.fcp).reduce((sum, [, d]) => sum + Math.max(0, d - 50), 0);
    const domNodes = await evaluate<number>(tab, "document.getElementsByTagName('*').length");
    const overflow = await evaluate<boolean>(tab, "document.documentElement.scrollWidth > innerWidth + 1");
    const c = curves[profile];
    const parts = { fcp: m.fcp, lcp: m.lcp || m.fcp, tbt, cls: m.cls, ttfb };
    const loadScore = 10 * Object.entries(weights).reduce((s, [k, w]) => s + w * logNormal(parts[k as keyof typeof parts], c[k as keyof typeof c]), 0);

    // Behaviour: the live preview, then every tab-like control, the search box, ⌘K, and a page-to-page navigation.
    const interactions: Interaction[] = [];
    let liveMs: number | undefined, live: string | undefined;
    if (page.live && !mobile) {
      const t0 = Date.now();
      for (; Date.now() - t0 < 15_000; await sleep(200)) {
        live = await evaluate<string>(tab, `(() => { const f = document.querySelector('iframe[title$="website"]'); if (f) return f.parentElement.querySelector('[aria-hidden="true"]') ? "live" : ""; return document.querySelector('img[alt$="website"]')?.complete ? "screenshot" : ""; })()`);
        if (live) break;
      }
      liveMs = live ? Date.now() - t0 : undefined;
      live ??= "never loaded";
    }
    const controls = await evaluate<number>(tab, `document.querySelectorAll('nav.tabs a, .seg button, .rfilter button, [role=tab], [data-set-view], [data-set-free], main button[aria-pressed]').length`);
    for (let i = 0; i < Math.min(controls, 8); i++) {
      const before = await eventCount(tab);
      const label = await click(tab, "nav.tabs a, .seg button, .rfilter button, [role=tab], [data-set-view], [data-set-free], main button[aria-pressed]", i);
      if (label) interactions.push({ name: `click "${label}"`, inp: await slowestSince(tab, before) });
    }
    if (await evaluate<boolean>(tab, `!!document.querySelector('main input[type=search], main input[type=text], main textarea')`)) {
      const before = await eventCount(tab);
      await click(tab, "main input[type=search], main input[type=text], main textarea");
      for (const ch of "toast") await key(tab, ch);
      interactions.push({ name: "type in search", inp: await slowestSince(tab, before) });
    }
    if (!mobile) {
      const before = await eventCount(tab);
      await key(tab, "k", 4); // ⌘K
      const opened = await evaluate<boolean>(tab, `new Promise((r) => setTimeout(() => r(!!document.querySelector('[cmdk-root], [role=dialog]')), 400))`);
      interactions.push({ name: "open ⌘K palette", inp: await slowestSince(tab, before), note: opened ? undefined : "palette did not open" });
      await key(tab, "Escape");
      await sleep(600); // let the palette finish closing before clicking the page under it
    }
    {
      const navs = await evaluate<number>(tab, "window.__bench.navs.length");
      const before = await eventCount(tab);
      const t0 = Date.now();
      if (await click(tab, `main a[href^="/browse/"], main a[href^="/best/"], main a[href="/atlas"]`)) {
        let ms: number | undefined;
        for (; Date.now() - t0 < 10_000; await sleep(50)) if ((await evaluate<number>(tab, "window.__bench?.navs.length ?? 0")) > navs || (await evaluate<number>(tab, "performance.getEntriesByType('navigation').length")) === 1 && (await evaluate<string>(tab, "location.pathname")) !== page.path) { ms = Date.now() - t0; break; }
        interactions.push({ name: "click through to a page", inp: await slowestSince(tab, before).catch(() => 0), ms, note: ms ? undefined : "navigation did not finish" });
      }
    }
    const worst = Math.max(0, ...interactions.map((i) => i.inp));
    const interactionScore = interactions.length ? 10 * logNormal(worst || 1, inpCurve) * (interactions.some((i) => i.note) ? 0.5 : 1) : 10;
    return {
      page: page.name, profile, ttfb: round(ttfb, 0), fcp: round(m.fcp, 0), lcp: round(m.lcp || m.fcp, 0), cls: round(m.cls, 3), tbt: round(tbt, 0),
      transferKB: round(loaded.transfer / 1024, 0), jsKB: round(loaded.js / 1024, 0), requests: loaded.requests, domNodes, lcpEl: m.lcpEl ?? "", loadScore: round(loadScore, 2),
      interactions, interactionScore: round(interactionScore, 2), overflow, consoleErrors, failed, uncached: [...new Set(uncached)], liveMs, live,
    };
  } finally {
    await tab.close();
  }
}

const results: Result[] = [];
await withChrome(async (openTab) => {
  for (const page of pages)
    for (const profile of ["desktop", "mobile"] as const) {
      const tries: Result[] = [];
      for (let r = 0; r < runs; r++) tries.push(await measure(openTab, page, profile));
      // Median run by load score; problems found in any run are kept.
      const mid = [...tries].sort((a, b) => a.loadScore - b.loadScore)[Math.floor(tries.length / 2)]!;
      mid.consoleErrors = [...new Set(tries.flatMap((t) => t.consoleErrors))];
      mid.failed = [...new Set(tries.flatMap((t) => t.failed))];
      mid.overflow = tries.some((t) => t.overflow);
      results.push(mid);
      const flags = [mid.overflow && "OVERFLOW", mid.consoleErrors.length && `${mid.consoleErrors.length} console errors`, mid.failed.length && `${mid.failed.length} failed requests`, mid.uncached.length && `${mid.uncached.length} assets not immutable`, mid.live && `preview ${mid.live}${mid.liveMs ? ` in ${mid.liveMs}ms` : ""}`].filter(Boolean).join(", ");
      console.log(`${page.name.padEnd(20)} ${profile.padEnd(7)} load ${mid.loadScore.toFixed(2).padStart(5)}  ui ${mid.interactionScore.toFixed(2).padStart(5)}  ttfb ${String(mid.ttfb).padStart(4)} fcp ${String(mid.fcp).padStart(5)} lcp ${String(mid.lcp).padStart(5)} tbt ${String(mid.tbt).padStart(4)} cls ${mid.cls.toFixed(3)}  ${String(mid.transferKB).padStart(5)}KB js ${String(mid.jsKB).padStart(4)}KB  inp ${Math.max(0, ...mid.interactions.map((i) => i.inp))}ms ${flags}`);
    }
});

mkdirSync("bench-results", { recursive: true });
const file = `bench-results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify({ base, runs, results }, null, 1));
const low = results.filter((r) => r.loadScore < min || r.interactionScore < min || r.overflow || r.consoleErrors.length || r.failed.length);
const avg = (k: "loadScore" | "interactionScore", p: string) => round(results.filter((r) => r.profile === p).reduce((s, r) => s + r[k], 0) / Math.max(1, results.filter((r) => r.profile === p).length), 2);
console.log(`\nmean load: desktop ${avg("loadScore", "desktop")}, mobile ${avg("loadScore", "mobile")} · mean interaction: desktop ${avg("interactionScore", "desktop")}, mobile ${avg("interactionScore", "mobile")}`);
console.log(low.length ? `${low.length} page/profile results below ${min} or with problems. Details: ${file}` : `every page scores ${min}+ with no problems. Details: ${file}`);
process.exit(low.length ? 1 : 0);
