// Build-time Astro integration: after every page is prerendered, writes each page's share card (/og/<path>.jpg,
// 1200x630, from its og:title, og:description and screenshot) and its Markdown copy (/<path>.md, for AI crawlers and
// agents, a static file each page links as rel=alternate). Runs in Node on the build machine, so no request ever pays for it.
// Only pages whose own og:image points at their own card get one (Base.astro decides: prerendered, not noindex).
import type { AstroIntegration } from "astro";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h, type ReactNode } from "react";
import satori from "satori";
import sharp from "sharp";
import { htmlToMarkdown, pageMeta } from "./src/lib/markdown.ts";
import { canonicalPath, markdownPath, ogImagePath, ORIGIN } from "./src/lib/site.ts";

const W = 1200, H = 630;
const C = { bg: "#000000", fg: "#f5f5f5", fg2: "#a1a1a6", fg3: "#8a8a90", line: "rgba(255,255,255,0.12)", blue: "#5b7cff" };

async function* htmlFiles(dir: string): AsyncGenerator<string> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== "_astro") yield* htmlFiles(p);
    else if (e.name.endsWith(".html")) yield p;
  }
}

const font = (weight: 400 | 600) => readFile(createRequire(import.meta.url).resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));

/** The tastebase mark (Rail.tsx), white with the blue dot. */
const mark = (size: number) =>
  h("svg", { width: size, height: size, viewBox: "0 0 100 100" }, h("path", { d: "M44 18V64Q44 80 60 80H68M28 40H64", fill: "none", stroke: C.fg, strokeWidth: 13, strokeLinecap: "round" }), h("circle", { cx: 76, cy: 24, r: 7.5, fill: C.blue }));

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** One card: name and description on the left; the site's screenshot, when the page has one, bleeding off the right. */
function card(title: string, description: string, shot?: string): ReactNode {
  const wide = !shot;
  return h(
    "div",
    { style: { width: W, height: H, display: "flex", background: C.bg, color: C.fg, fontFamily: "Inter", position: "relative" } },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", padding: "64px 0 56px 72px", width: wide ? W - 144 : 560, height: H } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600, letterSpacing: -0.6 } }, mark(34), "tastebase"),
      h("div", { style: { display: "flex", marginTop: wide ? 110 : 84, fontSize: wide ? 84 : 60, fontWeight: 600, lineHeight: 1.04, letterSpacing: wide ? -3 : -2 } }, clip(title, wide ? 60 : 48)),
      h("div", { style: { display: "flex", marginTop: 24, fontSize: wide ? 32 : 27, lineHeight: 1.35, color: C.fg2 } }, clip(description, wide ? 150 : 120)),
    ),
    h("div", { style: { display: "flex", position: "absolute", left: 72, bottom: 52, fontSize: 22, color: C.fg3 } }, new URL(ORIGIN).host),
    shot &&
      h("img", { src: shot, width: 620, height: 388, style: { position: "absolute", left: 624, top: 121, borderRadius: 18, border: `1px solid ${C.line}`, objectFit: "cover", objectPosition: "top" } }),
  );
}

export function shareCopies(): AstroIntegration {
  return {
    name: "tastebase:share-copies",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const fonts = [
          { name: "Inter", data: await font(400), weight: 400 as const },
          { name: "Inter", data: await font(600), weight: 600 as const },
        ];
        const shotUri = async (path: string) => {
          const png = await sharp(join(root, path)).resize(1240, 776, { fit: "cover", position: "top" }).png().toBuffer().catch(() => undefined);
          return png && `data:image/png;base64,${png.toString("base64")}`;
        };
        const pages: string[] = [];
        for await (const file of htmlFiles(root)) pages.push(file);
        let cards = 0;
        // A few at a time: each card is ~50ms of satori + sharp, and a few hundred pages run in well under a minute.
        for (let i = 0; i < pages.length; i += 8)
          await Promise.all(
            pages.slice(i, i + 8).map(async (file) => {
              const path = canonicalPath(`/${relative(root, file)}`);
              const html = await readFile(file, "utf8");
              const meta = pageMeta(html);
              const og = ogImagePath(path);
              if (!meta.image || new URL(meta.image).pathname !== og) return;
              await writeFile(join(root, markdownPath(path)), htmlToMarkdown(html, ORIGIN));
              const svg = await satori(card(meta.title.replace(/ · tastebase$/, ""), meta.description, meta.shot && (await shotUri(meta.shot))), { width: W, height: H, fonts });
              const out = join(root, og);
              await mkdir(dirname(out), { recursive: true });
              await sharp(Buffer.from(svg)).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
              cards++;
            }),
          );
        logger.info(`Wrote ${cards} share cards and Markdown copies.`);
      },
    },
  };
}
