// Screenshots each library's and recommended resource's site into site/public/shots/<id>.webp, a library's favicon into
// site/public/marks/<id>.png, and records which sites refuse to be framed in site/src/lib/unframeable.json (detail pages
// show those as a screenshot instead of a live iframe; checked here so no request ever pays for it).
// --full shoots those unframeable sites as a whole page instead (1280px wide, up to 3 screens tall) into
// site/public/shots/full/<id>.webp, which the detail panel scrolls through; site/src/lib/fullshots.json lists them
// with their heights.
// Run: node --experimental-strip-types scripts/capture.ts [--frames | --full] [id ...]   (needs Chromium or Chrome, or
// $CHROMIUM, and ImageMagick; --frames only re-checks the framing headers)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { libraries } from "../src/registry/index.ts";
import { resources } from "../src/registry/resources.ts";
import { withChrome, type Tab } from "./cdp.ts";
import { chromium } from "./chromium.ts";

const shots = "site/public/shots", marks = "site/public/marks", framesFile = "site/src/lib/unframeable.json";
mkdirSync(shots, { recursive: true });
mkdirSync(marks, { recursive: true });
const args = process.argv.slice(2);
const framesOnly = args.includes("--frames");
const only = new Set(args.filter((a) => !a.startsWith("--")));
const sites = [...libraries.map((l) => ({ id: l.id, url: l.url, frame: l.demo, mark: true })), ...resources.filter((r) => r.kind !== "reviewed").map((r) => ({ id: r.id, url: r.url, frame: undefined, mark: false }))];
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const WIDTH = 1280, MAX_H = 2400; // --full: desktop width, about three screens tall
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const unframeable = new Set<string>(existsSync(framesFile) ? JSON.parse(readFileSync(framesFile, "utf8")) : []);

/** False when the site's headers forbid framing it on another origin (X-Frame-Options, CSP frame-ancestors). */
async function frameable(url: string) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "user-agent": UA } }).catch(() => undefined);
  if (!res?.ok) return false;
  const xfo = res.headers.get("x-frame-options")?.toLowerCase() ?? "";
  const ancestors = res.headers.get("content-security-policy")?.match(/frame-ancestors([^;]*)/i)?.[1]?.trim() ?? "*";
  return !/deny|sameorigin/.test(xfo) && ancestors.split(/\s+/).includes("*");
}

if (args.includes("--full")) {
  await fullPages();
  process.exit();
}

for (const s of sites) {
  if (only.size && !only.has(s.id)) continue;
  // The live preview opens the demo page when there is one.
  if (await frameable(s.frame ?? s.url)) unframeable.delete(s.id);
  else unframeable.add(s.id);
  if (framesOnly) continue;
  const png = join(tmpdir(), `tb-${s.id}.png`);
  // A desktop user agent: bot checks (Vercel, Cloudflare) block "HeadlessChrome". GPU on, or WebGL pages shoot blank.
  const shoot = (wait: string) => execFileSync(chromium, ["--headless=new", `--user-agent=${UA}`, "--hide-scrollbars", "--force-dark-mode", wait, "--window-size=1440,900", `--screenshot=${png}`, s.url], { stdio: "ignore", timeout: 60_000 });
  try {
    // Pages with endless timers never use up a virtual-time budget; for those, shoot at load (may catch a fade-in).
    try { shoot("--virtual-time-budget=6000"); } catch { shoot("--timeout=15000"); }
    execFileSync("magick", [png, "-resize", "1200x", "-quality", "78", join(shots, `${s.id}.webp`)]);
  } catch (e) {
    console.warn(`shot failed: ${s.id} ${s.url}`, (e as Error).message);
  }
  const mark = join(marks, `${s.id}.png`);
  if (s.mark && !existsSync(mark)) {
    const host = new URL(s.url).hostname;
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${host}&sz=128`).catch(() => undefined);
    if (res?.ok) writeFileSync(mark, Buffer.from(await res.arrayBuffer()));
  }
  console.log("ok", s.id);
}
writeFileSync(framesFile, JSON.stringify([...unframeable].sort(), null, 1) + "\n");

/** Whole-page shots of the unframeable sites, one at a time; failures get one slower retry, then are listed. */
async function fullPages() {
  const full = join(shots, "full");
  mkdirSync(full, { recursive: true });
  const todo = sites.filter((s) => unframeable.has(s.id) && (!only.size || only.has(s.id)));
  const failed = new Map<string, string>();
  await withChrome(async (openTab) => {
    for (const [settle, pause] of [[2500, 1000], [8000, 5000]] as const) {
      for (const s of settle === 2500 ? todo : todo.filter((s) => failed.has(s.id))) {
        const tab = await openTab();
        try {
          await Promise.race([fullShot(tab, s.frame ?? s.url, settle, join(full, `${s.id}.webp`)), sleep(90_000).then(() => Promise.reject(new Error("timed out")))]);
          failed.delete(s.id);
          console.log("ok", s.id);
        } catch (e) {
          failed.set(s.id, (e as Error).message);
          console.warn("failed", s.id, (e as Error).message);
        }
        await tab.close().catch(() => {});
        await sleep(pause);
      }
    }
  });
  // id -> height at 1200px wide, so the panel's <img> reserves its space before it loads.
  const have = Object.fromEntries(readdirSync(full).sort().map((f) => [f.replace(/\.webp$/, ""), Number(execFileSync("magick", ["identify", "-format", "%h", join(full, f)], { encoding: "utf8" }))]).filter(([id]) => unframeable.has(id as string)));
  writeFileSync("site/src/lib/fullshots.json", JSON.stringify(have, null, 1) + "\n");
  const mb = readdirSync(full).reduce((n, f) => n + readFileSync(join(full, f)).length, 0) / 1e6;
  console.log(`${Object.keys(have).length} full pages, ${mb.toFixed(1)} MB; failed ${failed.size}:`);
  for (const [id, why] of failed) console.log(`  ${id}: ${why}`);
}

async function fullShot(tab: Tab, url: string, settle: number, out: string) {
  const run = async (expression: string) => (await tab.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.value;
  await tab.send("Network.setUserAgentOverride", { userAgent: UA });
  await tab.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: 800, deviceScaleFactor: 1, mobile: false });
  await tab.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await tab.send("Emulation.setScrollbarsHidden", { hidden: true });
  await tab.send("Page.enable");
  const loaded = new Promise((r) => tab.on("Page.loadEventFired", r));
  const nav = await tab.send("Page.navigate", { url });
  if (nav.errorText) throw new Error(nav.errorText);
  await Promise.race([loaded, sleep(30_000)]);
  const status = await run(`performance.getEntriesByType("navigation")[0]?.responseStatus ?? 0`);
  if (status >= 400) throw new Error(`HTTP ${status}`);
  // Bot walls (Cloudflare, reCAPTCHA, WAFs) often answer 200; their page is not the site.
  const wall = await run(`document.body?.innerText.slice(0, 3000).match(/verify you are human|security verification|are you a robot|access denied|select all images|just a moment/i)?.[0] ?? ([...document.querySelectorAll("iframe[src*='recaptcha/api2/bframe'], iframe[src*='hcaptcha']")].some((f) => f.offsetWidth > 200) ? "captcha" : "")`);
  if (wall) throw new Error(`bot wall ("${wall}")`);
  // Scroll down and back so lazy images and scroll-triggered reveals have rendered by the shot.
  await run(`(async () => { for (let y = 0; y <= ${MAX_H}; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); } scrollTo(0, 0); })()`);
  await sleep(settle);
  const height = Math.min(MAX_H, Math.max(800, await run("document.documentElement.scrollHeight")));
  const { data } = await tab.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: WIDTH, height, scale: 1 } });
  const png = join(tmpdir(), "tb-full.png"), tmp = join(tmpdir(), "tb-full.webp");
  writeFileSync(png, Buffer.from(data, "base64"));
  // A blank or single-colour page (still loading, blocked) is worse than the card shot, so it is never kept.
  const spread = Number(execFileSync("magick", [png, "-colorspace", "gray", "-format", "%[fx:standard_deviation]", "info:"], { encoding: "utf8" }));
  if (spread < 0.03) throw new Error(`blank (spread ${spread.toFixed(3)})`);
  execFileSync("magick", [png, "-resize", "1200x", "-quality", "60", "-define", "webp:method=6", tmp]);
  renameSync(tmp, out);
}
