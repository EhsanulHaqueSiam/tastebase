// `pnpm shot` in a design build's project: screenshots the built page at desktop and phone width into shots/, so the
// building agent can look at its work the way a person's agent with a browser would. Copied into the starter with
// browser.ts beside it; it imports only that and Node.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { browse } from "./browser.ts";

const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chrome = process.env.CHROMIUM ?? (existsSync(mac) ? mac : "chromium");
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

const server = createServer((req, res) => {
  const path = join("dist", normalize(new URL(req.url ?? "/", "http://x").pathname));
  const file = existsSync(path) && extname(path) ? path : join("dist", "index.html");
  res.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream");
  res.end(readFileSync(file));
});
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
mkdirSync("shots", { recursive: true });
// Two seconds in, once entrances have played out.
const ready = "performance.now() > 2000 && !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity) ? 'ok' : undefined";
await browse(chrome, async (shoot) => {
  await shoot(url, { width: 1440, height: 900, reduced: false, png: "shots/desktop.png" }, ready);
  await shoot(url, { width: 390, height: 844, reduced: false, png: "shots/mobile.png" }, ready);
});
server.close();
console.log("Saved shots/desktop.png (1440px) and shots/mobile.png (390px), the first screen of each. Read them to check the page.");
