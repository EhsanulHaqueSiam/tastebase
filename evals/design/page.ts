// Opens a built page in headless Chrome at desktop and phone width: a screenshot of each, and numbers read from
// the live page. The numbers are the look rules and the brief's asks that can be checked without a judge.
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { promisify } from "node:util";
import { chromium } from "../../scripts/chromium.ts";

const run = promisify(execFile);

export type Probe = {
  /** Uncaught errors and rejected promises while the page loaded. */
  errors: string[];
  /** Distinct saturated hues among text, fills and borders. Black, white and greys do not count. */
  accents: number;
  /** CSS and Web Animations that never end. */
  loops: number;
  /** Pixels the page is wider than the window. */
  overflow: number;
  /** Text a visitor can see, lowercased, cut at 6000 characters. Empty means a blank page. */
  text: string;
  /** Which of the asked-for selectors matched something visible. An svg or canvas must be chart-sized, not an icon. */
  found: boolean[];
  /** What pressing the asked-for control did: "opens" when a dialog or a block of new elements appeared. */
  click?: "missing" | "dead" | "opens";
};
/** What to look for on the page besides the standing numbers. `click` is a pattern for the control's text. */
export type Ask = { selectors: string[]; click?: string };

// Runs inside the page. Colours go through a canvas so oklch(), lab() and named colours all come back as RGB.
// shortcut: gradients, images and canvas or requestAnimationFrame loops are not counted; add them when a look rule needs them.
function probe(ask: Ask) {
  // Under virtual time headless Chrome never fires requestAnimationFrame, so a chart or a Motion entrance would be
  // shot at its first frame (empty bars, invisible text). Timers do run, so frames run on them.
  window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 16);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  const errors: string[] = [];
  addEventListener("error", (e) => errors.push(String(e.message)));
  addEventListener("unhandledrejection", (e) => errors.push(String(e.reason)));
  // Hidden, transparent or zero-sized elements do not count: what is graded is what a visitor sees.
  const seen = (el: Element) => {
    const { width, height } = el.getBoundingClientRect();
    return width > 0 && height > 0 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  };
  const visible = (css: string) => [...document.querySelectorAll(css)].filter(seen);
  const dialogs = () => visible('[role="dialog"], [role="alertdialog"], dialog, [aria-modal="true"], [data-vaul-drawer], [data-sonner-toast], [role="status"]').length;
  addEventListener("load", () =>
    setTimeout(() => {
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      const hues: number[] = [];
      const read = (css: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data as unknown as [number, number, number, number];
        const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510;
        if (a < 128 || max === min || (max - min) / 255 / (1 - Math.abs(2 * l - 1)) < 0.4 || l < 0.15 || l > 0.9) return;
        const h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
        hues.push((h * 60 + 360) % 360);
      };
      for (const el of document.querySelectorAll<HTMLElement>("body *")) {
        const box = el.getBoundingClientRect(), s = getComputedStyle(el);
        if (!box.width || !box.height || s.visibility === "hidden" || s.opacity === "0") continue;
        if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) read(s.color);
        read(s.backgroundColor);
        if (s.borderTopWidth !== "0px") read(s.borderTopColor);
      }
      hues.sort((a, b) => a - b);
      // Hues within 30 degrees of each other are one accent, around the colour wheel.
      const gaps = hues.filter((h, i) => h - (hues[i - 1] ?? hues.at(-1)! - 360) > 30).length;
      const result: Probe = {
        errors,
        accents: hues.length ? Math.max(1, gaps) : 0,
        loops: document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations === Infinity).length,
        overflow: document.documentElement.scrollWidth - innerWidth,
        text: (() => {
          const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), parts: string[] = [];
          for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.textContent?.trim() && n.parentElement && seen(n.parentElement)) parts.push(n.textContent.trim());
          return parts.join("\n").toLowerCase().slice(0, 6000);
        })(),
        found: ask.selectors.map((s) =>
          visible(s).some((el) => {
            const { width, height } = el.getBoundingClientRect();
            return !el.matches("svg, canvas") || (width >= 160 && height >= 80);
          }),
        ),
      };
      const write = () => {
        const out = document.createElement("script");
        out.type = "application/json";
        out.id = "tb-probe";
        out.textContent = JSON.stringify(result);
        top!.document.head.append(out);
      };
      if (!ask.click) return write();
      const control = visible('button, [role="button"], a').find((el) => new RegExp(ask.click!, "i").test(`${(el as HTMLElement).innerText} ${el.getAttribute("aria-label") ?? ""}`)) as HTMLElement | undefined;
      if (!control) return (result.click = "missing"), write();
      // A dialog, sheet or toast that shows up, or a block of new visible elements, whether added or revealed.
      const before = [dialogs(), visible("body *").length] as const;
      control.click();
      setTimeout(() => {
        result.click = dialogs() > before[0] || visible("body *").length > before[1] + 4 ? "opens" : "dead";
        write();
      }, 1200);
    }, 1500),
  );
}

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
const NOTHING: Probe = { errors: ["page did not finish loading"], accents: 0, loops: 0, overflow: 0, text: "", found: [] };

/**
 * Screenshots `<out>/desktop.png` and `<out>/mobile.png` of the site in `dist`, and what the probe read at each
 * width. `reduced` is the desktop page again for a visitor who asked for less motion, after pressing `ask.click`.
 */
export async function inspect(dist: string, out: string, ask: Ask): Promise<{ desktop: Probe; mobile: Probe; reduced: Probe }> {
  const server = createServer((req, res) => {
    const { pathname, searchParams: q } = new URL(req.url ?? "/", "http://x");
    // Headless Chrome never lays a window out narrower than 500px, so the page is shown in a frame of the size wanted.
    if (pathname === "/__frame") return res.setHeader("content-type", "text/html").end(`<body style="margin:0;background:#000"><iframe src="/${q.has("click") ? "?click" : ""}" style="border:0;display:block;width:${Number(q.get("w"))}px;height:${Number(q.get("h"))}px"></iframe>`);
    const path = join(dist, normalize(pathname));
    const file = existsSync(path) && extname(path) ? path : join(dist, "index.html");
    const html = extname(file) === ".html";
    const asked: Ask = q.has("click") ? ask : { selectors: ask.selectors };
    res.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream");
    res.end(html ? readFileSync(file, "utf8").replace("<head>", `<head><script>(${probe})(${JSON.stringify(asked)})</script>`) : readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const at = async (name: string, w: number, h: number, ...more: string[]): Promise<Probe> => {
      const args = ["--headless=new", "--hide-scrollbars", "--virtual-time-budget=8000", `--window-size=${w},${h}`, `--screenshot=${join(out, `${name}.png`)}`, "--dump-dom", ...more, `${origin}/__frame?w=${w}&h=${h}${name === "reduced" ? "&click" : ""}`];
      const { stdout } = await run(chromium, args, { timeout: 60_000, maxBuffer: 64 << 20 });
      const found = /<script type="application\/json" id="tb-probe">([\s\S]*?)<\/script>/.exec(stdout)?.[1];
      // No probe output means the page never reached `load`: the script that should render it crashed.
      return found ? JSON.parse(found) : NOTHING;
    };
    // shortcut: the first screen only, since Chrome's CLI cannot capture a full page; switch to a driver if the judge needs more.
    // Motion preference is forced both ways, or the result would follow the setting of the machine running the eval.
    const moving = "--force-prefers-no-reduced-motion";
    return { desktop: await at("desktop", 1440, 900, moving), mobile: await at("mobile", 390, 844, moving), reduced: await at("reduced", 1440, 900, "--force-prefers-reduced-motion") };
  } finally {
    server.close();
  }
}
