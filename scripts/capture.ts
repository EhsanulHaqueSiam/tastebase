// Screenshots each library's and recommended resource's site into site/public/shots/<id>.webp, a library's favicon into
// site/public/marks/<id>.png, and records which sites refuse to be framed in site/src/lib/unframeable.json (detail pages
// show those as a screenshot instead of a live iframe; checked here so no request ever pays for it).
// Run: node --experimental-strip-types scripts/capture.ts [--frames] [id ...]   (needs Chromium or Chrome, or $CHROMIUM,
// and ImageMagick; --frames only re-checks the framing headers)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { libraries } from "../src/registry/index.ts";
import { resources } from "../src/registry/resources.ts";
import { chromium } from "./chromium.ts";

const shots = "site/public/shots", marks = "site/public/marks", framesFile = "site/src/lib/unframeable.json";
mkdirSync(shots, { recursive: true });
mkdirSync(marks, { recursive: true });
const args = process.argv.slice(2);
const framesOnly = args.includes("--frames");
const only = new Set(args.filter((a) => a !== "--frames"));
const sites = [...libraries.map((l) => ({ id: l.id, url: l.url, mark: true })), ...resources.filter((r) => r.kind !== "reviewed").map((r) => ({ id: r.id, url: r.url, mark: false }))];
const unframeable = new Set<string>(existsSync(framesFile) ? JSON.parse(readFileSync(framesFile, "utf8")) : []);

/** False when the site's headers forbid framing it on another origin (X-Frame-Options, CSP frame-ancestors). */
async function frameable(url: string) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36" } }).catch(() => undefined);
  if (!res?.ok) return false;
  const xfo = res.headers.get("x-frame-options")?.toLowerCase() ?? "";
  const ancestors = res.headers.get("content-security-policy")?.match(/frame-ancestors([^;]*)/i)?.[1]?.trim() ?? "*";
  return !/deny|sameorigin/.test(xfo) && ancestors.split(/\s+/).includes("*");
}

for (const s of sites) {
  if (only.size && !only.has(s.id)) continue;
  if (await frameable(s.url)) unframeable.delete(s.id);
  else unframeable.add(s.id);
  if (framesOnly) continue;
  const png = join(tmpdir(), `tb-${s.id}.png`);
  try {
    execFileSync(chromium, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-dark-mode", "--virtual-time-budget=6000", "--window-size=1440,900", `--screenshot=${png}`, s.url], { stdio: "ignore", timeout: 60_000 });
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
