// Screenshots each library's site into site/public/shots/<id>.webp and its favicon into site/public/marks/<id>.png.
// Run: node --experimental-strip-types scripts/capture.ts [id ...]   (needs chromium and ImageMagick)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { libraries } from "../src/registry/index.ts";

const shots = "site/public/shots", marks = "site/public/marks";
mkdirSync(shots, { recursive: true });
mkdirSync(marks, { recursive: true });
const only = new Set(process.argv.slice(2));

for (const l of libraries) {
  if (only.size && !only.has(l.id)) continue;
  const png = join(tmpdir(), `tb-${l.id}.png`);
  try {
    execFileSync("chromium", ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-dark-mode", "--virtual-time-budget=6000", "--window-size=1440,900", `--screenshot=${png}`, l.url], { stdio: "ignore", timeout: 60_000 });
    execFileSync("magick", [png, "-resize", "1200x", "-quality", "78", join(shots, `${l.id}.webp`)]);
  } catch (e) {
    console.warn(`shot failed: ${l.id} ${l.url}`, (e as Error).message);
  }
  const mark = join(marks, `${l.id}.png`);
  if (!existsSync(mark)) {
    const host = new URL(l.url).hostname;
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${host}&sz=128`).catch(() => undefined);
    if (res?.ok) writeFileSync(mark, Buffer.from(await res.arrayBuffer()));
  }
  console.log("ok", l.id);
}
