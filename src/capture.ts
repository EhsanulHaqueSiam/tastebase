// `capture`: read a live page's design system (colours, fonts, type scale, radii, shadows, spacing, a button, its CSS
// variables) so an agent can match a reference instead of guessing it from a screenshot. It runs in `npx tastebase`
// only, in the user's own Chrome (src/capture-local.ts), signed in or not; why not hosted: docs/internals/overview.md.

export type Capture = {
  url: string;
  title: string;
  width: number;
  bg: string;
  text: string;
  /** Colours by share of painted area (backgrounds) and text, most used first: [hex, percent]. */
  palette: [string, number][];
  accent?: string;
  /** Font families by share of visible text: [family, percent, sizes px, weights]. */
  fonts: [string, number, number[], number[]][];
  bodySize?: string;
  radii: [string, number][];
  shadows: [string, number][];
  spacing: number[];
  contentWidth?: number;
  sections: number;
  headings: string[];
  button?: { bg: string; color: string; radius: string; padding: string; font: string; border: string };
  vars: [string, string][];
};

/** Expression evaluated in the page; returns a `Capture`. Plain JS in a string: a bundler's helpers (esbuild's __name) would be undefined in the page. */
export const PAGE_SCRIPT = String.raw`(() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const memo = new Map();
  // Any CSS colour (oklch, color(), named) to sRGB hex through a 1px canvas; null when mostly transparent.
  const hex = (c) => {
    if (!c || c === "transparent") return null;
    if (memo.has(c)) return memo.get(c);
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
    const out = a < 40 ? null : "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    memo.set(c, out);
    return out;
  };
  const sat = (h) => { const n = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(...n) - Math.min(...n); };
  const add = (m, k, n = 1) => k != null && m.set(k, (m.get(k) || 0) + n);
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
  const W = innerWidth, H = innerHeight * 3;
  const areas = new Map(), texts = new Map(), fams = new Map(), radii = new Map(), shadows = new Map(), space = new Map(), widths = new Map(), sizes = new Map(), accents = new Map();
  const pageBg = hex(getComputedStyle(document.body).backgroundColor) || hex(getComputedStyle(document.documentElement).backgroundColor) || "#ffffff";
  let button;
  const els = [...document.body.querySelectorAll("*")].slice(0, 5000);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > H) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || +s.opacity < 0.1) continue;
    const area = Math.min(r.width, W) * Math.min(r.height, H);
    const bg = hex(s.backgroundColor);
    if (bg) add(areas, bg, area);
    let own = 0;
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent.trim().length;
    if (own) {
      const c = hex(s.color);
      add(texts, c, own);
      const f = s.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      const e = fams.get(f) || { n: 0, sizes: new Map(), weights: new Map() };
      e.n += own; add(e.sizes, Math.round(parseFloat(s.fontSize)), own); add(e.weights, +s.fontWeight || 400, own);
      fams.set(f, e);
      add(sizes, Math.round(parseFloat(s.fontSize)) + "/" + (s.lineHeight === "normal" ? "normal" : Math.round(parseFloat(s.lineHeight))), own);
      if (el.closest("a") && c && sat(c) > 60) add(accents, c, 1);
    }
    const rad = s.borderTopLeftRadius.split(" ")[0];
    if (rad !== "0px" && (bg || s.borderTopStyle !== "none" || el.tagName === "IMG")) add(radii, parseFloat(rad) >= 999 ? "pill" : rad);
    // Transparent layers (a transition's resting state) paint nothing.
    const shadow = s.boxShadow.split(/,(?![^(]*\))/).filter((l) => !/rgba\([^)]*,\s*0\)/.test(l)).join(",").trim();
    if (shadow && shadow !== "none") add(shadows, shadow.length > 90 ? shadow.slice(0, 90) + "…" : shadow);
    for (const v of [s.paddingTop, s.paddingLeft, s.rowGap, s.columnGap]) { const px = parseFloat(v); if (px > 0 && px <= 160) add(space, Math.round(px)); }
    if (r.width >= 560 && r.width < W - 24 && Math.abs(r.left - (W - r.right)) < 4) add(widths, Math.round(r.width));
    const clickable = el.matches("button, a, [role=button], input[type=submit]");
    if (clickable && bg && bg !== pageBg && r.width < 360 && r.height < 80 && r.top < innerHeight * 1.5) {
      if (sat(bg) > 60) add(accents, bg, 3);
      button ||= { bg, color: hex(s.color) || s.color, radius: s.borderRadius, padding: s.paddingTop + " " + s.paddingLeft, font: Math.round(parseFloat(s.fontSize)) + "px " + s.fontWeight, border: s.borderTopStyle === "none" ? "none" : s.borderTopWidth + " " + (hex(s.borderTopColor) || "") };
    }
  }
  const share = (m) => { const t = [...m.values()].reduce((a, b) => a + b, 0) || 1; return top(m, 6).map(([k, v]) => [k, Math.round((v / t) * 100)]); };
  const palette = new Map();
  for (const [k, v] of share(areas)) add(palette, k, v);
  for (const [k, v] of share(texts)) add(palette, k, v / 2);
  const vars = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      if (!rule.style || !/^(:root|html|:host)\b/.test(rule.selectorText || "")) continue;
      // Design tokens only (colour, type, radius, space, shadow), not z-index layers or layout maths.
      for (const p of rule.style) {
        const v = rule.style.getPropertyValue(p).trim();
        if (p.startsWith("--") && vars.length < 24 && !vars.some((x) => x[0] === p) && (/(^|-)(colou?rs?|bg|background|fg|foreground|text|accent|primary|brand|border|radius|font|space|spacing|gap|shadow)(-|$)/.test(p) || /^(#|rgb|hsl|oklch|oklab|lab|lch|color)/.test(v)) && v.length < 60) vars.push([p, v]);
      }
    }
  }
  const body = top(sizes, 1)[0];
  return {
    url: location.href, title: document.title.slice(0, 80), width: W, bg: pageBg, text: top(texts, 1)[0]?.[0] || "#000000",
    palette: top(palette, 8).map(([k, v]) => [k, Math.round(v)]),
    accent: top(accents, 1)[0]?.[0],
    fonts: share(new Map([...fams].map(([f, e]) => [f, e.n]))).slice(0, 4).map(([f, p]) => [f, p, top(fams.get(f).sizes, 8).map(([k]) => k).sort((a, b) => b - a), top(fams.get(f).weights, 4).map(([k]) => k).sort((a, b) => a - b)]),
    bodySize: body && body[0],
    radii: top(radii, 5), shadows: top(shadows, 3),
    spacing: top(space, 10).map(([k]) => k).sort((a, b) => a - b),
    contentWidth: top(widths, 1)[0]?.[0],
    sections: document.querySelectorAll("section").length || [...(document.querySelector("main") || document.body).children].filter((c) => c.getBoundingClientRect().height > 200).length,
    headings: [...new Set([...document.querySelectorAll("h1, h2")].filter((h) => h.getBoundingClientRect().height > 0).map((h) => h.tagName + " " + h.innerText.trim().replace(/\s+/g, " ").slice(0, 60)))].filter((h) => h.length > 3).slice(0, 6),
    button, vars,
  };
})()`;

/** The `capture` answer agents read: compact lines, most-used first. */
export function formatCapture(c: Capture): string {
  const px = (n: number[]) => n.join(" ");
  return [
    `capture: ${c.title || c.url} ${c.url} (${c.width}px wide)`,
    `colours: bg ${c.bg}, text ${c.text}${c.accent ? `, accent ${c.accent}` : ""} | by use: ${c.palette.map(([h, p]) => `${h} ${p}%`).join(", ")}`,
    `fonts: ${c.fonts.map(([f, p, s, w]) => `${f} ${p}% (sizes ${px(s)}; weights ${px(w)})`).join(" | ")}${c.bodySize ? ` | most text ${c.bodySize}px size/line-height` : ""}`,
    c.radii.length && `radius: ${c.radii.map(([r, n]) => `${r} ×${n}`).join(", ")}`,
    c.shadows.length && `shadows: ${c.shadows.map(([s, n]) => `${s} ×${n}`).join(" | ")}`,
    c.spacing.length && `spacing (px): ${px(c.spacing)}`,
    `layout: ${c.contentWidth ? `content ${c.contentWidth}px wide, ` : ""}${c.sections} sections`,
    c.button && `button: bg ${c.button.bg}, text ${c.button.color}, radius ${c.button.radius}, padding ${c.button.padding}, ${c.button.font}, border ${c.button.border}`,
    c.headings.length && `headings: ${c.headings.join(" | ")}`,
    c.vars.length && `css vars: ${c.vars.map(([k, v]) => `${k}: ${v}`).join("; ")}`,
    "Match its tokens, not its content: use your own copy, images and brand.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** What a capture runner hands the tool: the page's tokens (and a JPEG when it can shoot one), or why it failed. */
export type CaptureResult = { capture: Capture; jpeg?: string } | { error: string };
export type CaptureRunner = (url: string) => Promise<CaptureResult>;

/** The tool as `tools/list` shows it, for the relay to add to the hosted server's list; mcp.ts registers the same. */
export const CAPTURE_TOOL = {
  name: "capture",
  description: "Screenshot a live page and read its design tokens: colours, fonts, sizes, radius, shadows, spacing, CSS vars. For matching a site the user names.",
  inputSchema: { type: "object" as const, properties: { url: { type: "string" } }, required: ["url"] },
  annotations: { readOnlyHint: true },
};

/** The `capture` tool's answer as MCP content, from any runner. Only http(s) URLs reach a browser. */
export async function captureAnswer(run: CaptureRunner, url: string) {
  const ok = /^https?:\/\//i.test(url) && URL.canParse(url);
  const r = ok ? await run(url).catch((e: Error) => ({ error: e.message })) : { error: "capture takes an http(s) URL." };
  if ("error" in r) return { content: [{ type: "text" as const, text: `Could not capture ${url}: ${r.error}` }], isError: true };
  return {
    content: [
      { type: "text" as const, text: formatCapture(r.capture) },
      ...(r.jpeg ? [{ type: "image" as const, data: r.jpeg, mimeType: "image/jpeg" }] : []),
    ],
  };
}
