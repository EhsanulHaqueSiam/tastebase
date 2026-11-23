// Server-only, build time: the look specimens /looks and /looks/<id> draw from each look's swatch, as HTML strings.
// Their CSS is site/src/specimens.css, which applies inside a .lk (the /looks page) or .lp (a look's own page).
import type { Aesthetic, Swatch } from "../../../src/registry/schema.ts";
import { libraries } from "./server.ts";

// Mean relative luminance of the hex colours in a CSS value, so gradients count too.
export const lum = (css: string) => {
  const hexes = css.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi) ?? [];
  const one = (h: string) => {
    const x = h.length === 4 ? [...h.slice(1)].map((d) => d + d).join("") : h.slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  return hexes.length ? hexes.reduce((s, h) => s + one(h), 0) / hexes.length : 0.5;
};
export const isDark = (a: Aesthetic) => lum(a.swatch.bg) < 0.2;
// Text on the accent: whichever of near-black or white contrasts more (they tie at luminance ~0.19).
export const ink = (c: string) => (lum(c) > 0.19 ? "#111" : "#fff");
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const mix = (c: string, p: number, d = "transparent") => `color-mix(in srgb,${c} ${p}%,${d})`;
const hexes = (css: string) => css.match(/#[0-9a-f]{6}\b/gi) ?? [];
const shadow = (card = "") => card.match(/box-shadow:([^;]+)/)?.[1] ?? "";
// Paired neumorphic shadows turned inward at half depth: the pressed state of the same material.
const pressed = (card?: string) => shadow(card).split(/,(?![^(]*\))/).map((sh) => `inset ${sh.trim().replace(/-?\d+(?:\.\d+)?px/g, (n) => `${parseFloat(n) / 2}px`)}`).join(",");
const spark = (pts: number[], c: string) =>
  `<svg viewBox="0 0 ${(pts.length - 1) * 4} 12" preserveAspectRatio="none"><polyline points="${pts.map((y, i) => `${i * 4},${12 - y}`).join(" ")}" fill="none" stroke="${c}" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
const lib = (id: string) => libraries.find((l) => l.id === id);
const wrap = (text: string, n: number) =>
  text.split(" ").reduce<string[]>((out, w) => {
    const last = out.at(-1);
    if (last !== undefined && `${last} ${w}`.length <= n) out[out.length - 1] = `${last} ${w}`;
    else out.push(w);
    return out;
  }, []);
// The hues a look's colour rule names ("pink #ff71ce", "teal (#2f6f6a)"), keyed by lowercase name in rule order.
const named = (a: Aesthetic) => Object.fromEntries([...a.colour.matchAll(/([a-z]+) \(?(#[0-9a-f]{6})\b/gi)].map(([, n, c]) => [n!.toLowerCase(), c!]));
// Seeded jitter so the hand-drawn strokes are identical on every build.
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
// A rough.js-style box: each side a slightly bowed, overshooting stroke, drawn twice.
const roughBox = (x: number, y: number, w: number, h: number, seed: number) => {
  const r = rng(seed), j = (n = 1.6) => (r() - 0.5) * n;
  const side = (x1: number, y1: number, x2: number, y2: number) =>
    `M${(x1 + j()).toFixed(1)} ${(y1 + j()).toFixed(1)}Q${((x1 + x2) / 2 + j(2.4)).toFixed(1)} ${((y1 + y2) / 2 + j(2.4)).toFixed(1)} ${(x2 + j()).toFixed(1)} ${(y2 + j()).toFixed(1)}`;
  const pass = () => side(x - 1, y, x + w + 1.5, y) + side(x + w, y - 1, x + w, y + h + 1.5) + side(x + w + 1, y + h, x - 1.5, y + h) + side(x, y + h + 1, x, y - 1.5);
  return pass() + pass();
};
// Four-point sparkle and a heart, the stickers of kawaii and AI "magic" buttons.
const star = (cx: number, cy: number, r: number) => {
  const k = r * 0.18;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
};
const heart = (x: number, y: number, s: number) => `M${x} ${y + s * 0.9}C${x - s * 1.2} ${y + s * 0.1} ${x - s * 0.6} ${y - s * 0.7} ${x} ${y - s * 0.15}C${x + s * 0.6} ${y - s * 0.7} ${x + s * 1.2} ${y + s * 0.1} ${x} ${y + s * 0.9}Z`;
// 24-unit icons, filled or stroked.
const glyph = (d: string, cls = "") => `<svg${cls && ` class="${cls}"`} viewBox="0 0 24 24"><path d="${d}" fill="currentColor"/></svg>`;
const outline = (d: string, cls = "") => `<svg${cls && ` class="${cls}"`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
// Pixel art from rows of palette keys ("." is empty): one path per colour, one rect per horizontal run.
const sprite = (rows: string[], pal: Record<string, string>, x0 = 0, y0 = 0) => {
  const d: Record<string, string> = {};
  rows.forEach((r, y) => {
    for (const { 0: run, 1: c = "", index: x } of r.matchAll(/([^.])\1*/g)) d[c] = `${d[c] ?? ""}M${x0 + x} ${y0 + y}h${run.length}v1h-${run.length}z`;
  });
  return Object.entries(d).map(([c, p]) => `<path d="${p}" fill="${pal[c]}"/>`).join("");
};
// A lit sphere and its contact shadow in 1-bit dots, ordered-dithered through a 4x4 Bayer matrix once per build.
const dots = ((W: number, H: number) => {
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], n = Math.hypot(-0.55, -0.6, 0.58);
  const shade = (x: number, y: number) => {
    const dx = (x - W * 0.7) / (H * 0.36), dy = (y - H * 0.42) / (H * 0.36), d = dx * dx + dy * dy;
    if (d <= 1) return Math.max(0, (-0.55 * dx - 0.6 * dy + 0.58 * Math.sqrt(1 - d)) / n) * 0.95 + 0.04;
    const sx = (x - W * 0.74) / (H * 0.42), sy = (y - H * 0.86) / (H * 0.07), sd = sx * sx + sy * sy;
    return sd <= 1 ? 0.25 + 0.75 * sd : 1; // the shadow, else clean paper: dots only where there is form
  };
  const rows = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (shade(x + 0.5, y + 0.5) < (bayer[(y % 4) * 4 + (x % 4)]! + 0.5) / 16 ? "k" : ".")).join(""));
  return sprite(rows, { k: "currentColor" });
})(80, 60);

// Close-up specimens: one moment of the look at near real size, in its own words, cropped by the card edge.
// Sized in container units (.spec), so the same markup serves the card, the panel and compare.
export const parts = (s: Swatch) => ({
  surf: `background:${s.surface};${s.card ?? ""}`,
  tile: `background:${s.surface};border-radius:${Math.min(s.radius, 16)}px;${s.card ?? ""}`,
  btn: `background:${s.accent};color:${ink(s.accent)};border-radius:${Math.min(s.radius, 12)}px`,
  acc: `background:${s.accent}`,
});
export const layouts: Record<NonNullable<Swatch["layout"]>, (a: Aesthetic, x: ReturnType<typeof parts>, s: Swatch) => string> = {
  bento: (a, x) =>
    `<div class="be"><div class="t t1" style="${x.tile}"><b>Ship it.</b><span>${esc(a.name)}</span></div><div class="t t2" style="${x.tile}"><b>99.9%</b><span>uptime</span></div><div class="t t3" style="${x.tile};${x.acc};color:${ink(a.swatch.accent)}">&rarr;</div><div class="t t4" style="${x.tile}"><span class="tog" style="${x.acc}"><i></i></span></div><div class="t t5" style="${x.tile}"><span>12ms</span></div></div>`,
  columns: (a) =>
    `<div class="co"><div class="mast" style="${a.swatch.card ?? ""}"><b>The ${esc(a.name.split(/[ /]/)[0]!)} Review</b><span>Vol. 12 · No. 4</span></div><b class="hl">${esc(a.name)}</b><p class="body">${esc(a.summary)} ${esc(a.type)}</p></div>`,
  // One word fitted edge to edge; everything else small and quiet, one accent link. The paper-backed caption cuts the descenders off at its rule.
  poster: (a, _, s) => {
    const word = a.name.split(" ").at(-1)!;
    return `<div class="q qpos"><div class="mt"><span>${esc(a.name)}</span><span>No. 04</span></div><b class="g">${esc(word[0]!.toUpperCase() + word.slice(1))}</b><p style="background:${s.bg}">${esc(a.summary.split(":")[1]?.trim() ?? a.summary)}</p><span class="cta" style="color:${s.accent}">Read the rule →</span></div>`;
  },
  steps: (a, x) =>
    `<div class="sp"><div class="txt"><b style="color:${a.swatch.accent}">02</b><span>The chart redraws as you read.</span><span class="dots"><i></i><i style="${x.acc}"></i><i></i><i></i></span></div><div class="g" style="${x.tile}">${[30, 52, 44, 78, 60, 92].map((h, i) => `<i style="height:${h}%;${i >= 4 ? x.acc : ""}"></i>`).join("")}</div></div>`,
  // Square corners read as Windows 9x; anything rounder gets macOS traffic lights.
  window: (a, x) => {
    const nine = a.swatch.radius === 0;
    const tb = nine
      ? `<div class="tb nine" style="${x.acc};color:${ink(a.swatch.accent)}"><span>Display Properties</span><span class="ctl"><i style="${x.surf}">?</i><i style="${x.surf}">×</i></span></div><div class="tabs9"><span style="${x.surf}">Background</span><span>Screen Saver</span><span>Appearance</span></div>`
      : `<div class="tb mac"><span class="lights"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></span><span>${esc(a.name)}</span></div>`;
    const b = ` style="${nine ? x.surf : x.btn}"`;
    return `<div class="wi" style="${x.surf};border-radius:${Math.min(a.swatch.radius, 12)}px">${tb}<div class="wb"><div class="mon" style="${x.acc}"></div><span class="wbtn"><span${b}>OK</span><span${nine ? b : ""} class="ghost">Cancel</span><span${nine ? b : ""} class="ghost">Apply</span></span></div></div>`;
  },
  document: (a, x) =>
    `<div class="dc" style="${x.surf}"><span class="crumb">Docs / Guides</span><b class="dt">Getting started</b><p>${esc(a.summary)}</p><div class="call" style="border-color:${a.swatch.accent};background:color-mix(in srgb,${a.swatch.accent} 14%,transparent)">Avoid: ${esc(a.avoid[0] ?? "a second accent")}</div><span class="todo"><i style="border-color:${a.swatch.accent};${x.acc};color:${ink(a.swatch.accent)}">✓</i>Pick a look</span><span class="todo"><i></i>Install the kit</span></div>`,
  // A diff: additions carry the one accent, deletions only dim.
  diff: (_, x, s) => {
    const ln = (o: string, n: string, sign: string, code: string) =>
      `<div class="ln${sign === "-" ? " del" : ""}"${sign === "+" ? ` style="background:${mix(s.accent, 13)}"` : ""}><i>${o}</i><i>${n}</i><code>${sign === "+" ? `<b style="color:${s.accent}">+</b>` : sign || " "}${esc(code)}</code></div>`;
    return `<div class="df" style="${x.surf};border-radius:${Math.min(s.radius, 12)}px"><div class="fh"><span>src/palette.tsx</span><b style="color:${s.accent}">+2</b><b class="m">-1</b></div><div class="hk">@@ -1,5 +1,6 @@</div>${[
      ln("1", "1", "", `import { useState } from "react";`),
      ln("2", "", "-", `import { Menu } from "./menu";`),
      ln("", "2", "+", `import { Command } from "cmdk";`),
      ln("", "3", "+", `import { useReactTable } from "@tanstack/react-table";`),
      ln("3", "4", "", ""),
      ln("4", "5", "", "export function Palette() {"),
      ln("5", "6", "", `  return <Command label="Looks">`),
    ].join("")}</div>`;
  },
  // Panels tiled edge to edge, a numeric grid with sparklines; the cropped panel is a chart, never a column of words.
  ticker: (a, x, s) => {
    const rows: [string, string, string, string, number[]][] = [
      ["api-gateway", "12.4k", "12", "0.01", [5, 6, 5, 7, 6, 8, 7, 9, 8]],
      ["auth", "3.1k", "48", "0.00", [6, 6, 7, 6, 6, 7, 6, 6, 7]],
      ["search", "1.9k", "210", "0.42", [3, 4, 3, 5, 7, 6, 9, 10, 11]],
      ["billing", "640", "31", "0.00", [4, 5, 4, 4, 5, 4, 5, 4, 4]],
      ["queue", "8.8k", "9", "0.02", [8, 7, 8, 6, 7, 5, 6, 5, 4]],
      ["edge", "22.1k", "6", "0.00", [6, 7, 8, 8, 9, 9, 10, 10, 11]],
      ["storage", "1.2k", "88", "0.11", [5, 4, 6, 5, 7, 6, 5, 7, 6]],
    ];
    const hot = (e: string) => (Number(e) > 0.1 ? ` style="color:${s.accent}"` : "");
    return `<div class="tk"><div class="fb" style="${x.acc};color:${ink(s.accent)}"><b>${esc(a.name.split(" ")[0]!.toUpperCase())}</b><span>SVC</span><span>P95</span><span>1H</span><span>LIVE</span></div><div class="tg"><div class="tp" style="${x.surf}"><div class="th" style="color:${s.accent}"><span>Svc</span><span>Rps</span><span>P95</span><span>Err%</span><span>1h</span></div>${rows
      .map(([n, r, p, e, pts]) => `<div class="r"><span>${n}</span><span>${r}</span><span${hot(e)}>${p}</span><span${hot(e)}>${e}</span>${spark(pts, hot(e) ? s.accent : "currentColor")}</div>`)
      .join("")}</div><div class="tp" style="${x.surf}"><div class="th" style="color:${s.accent}"><span>P95 · 1h</span></div><div class="bars">${[30, 42, 38, 55, 48, 62, 58, 80, 72, 90].map((h, i) => `<i style="height:${h}%;${i > 6 ? `${x.acc};opacity:1` : ""}"></i>`).join("")}</div></div></div></div>`;
  },
  // Linework with drafting marks on the look's own graph paper, title block cropped bottom right.
  drawing: (a, _, s) => {
    const c = s.accent;
    return `<div class="bp" style="${s.card ?? ""};background-color:${s.bg};border:0"><svg viewBox="0 0 200 150" font-family="JetBrains Mono, monospace">
      <g fill="none" stroke="${s.text}" stroke-width="1.4" vector-effect="non-scaling-stroke"><rect x="38" y="50" width="190" height="72" rx="8" vector-effect="non-scaling-stroke"/><rect x="52" y="92" width="56" height="17" rx="4" vector-effect="non-scaling-stroke"/></g>
      <g stroke="${s.text}" stroke-opacity=".7" stroke-width="1" vector-effect="non-scaling-stroke"><path d="M52 66H150M52 75H124" vector-effect="non-scaling-stroke"/></g>
      <g fill="none" stroke="${c}" stroke-width="1" vector-effect="non-scaling-stroke">
        <path d="M52 90V78M108 90V78M52 82H108M49.5 84.5l5-5M105.5 84.5l5-5" vector-effect="non-scaling-stroke"/>
        <path d="M36 50H22M36 122H22M26 50V122M23.5 52.5l5-5M23.5 124.5l5-5" vector-effect="non-scaling-stroke"/>
        <path d="M30 100.5H200" stroke-dasharray="7 2 1.5 2" stroke-opacity=".7" vector-effect="non-scaling-stroke"/>
        <path d="M40.5 52.5L60 32H80" vector-effect="non-scaling-stroke"/><circle cx="40.5" cy="52.5" r="1.4" fill="${c}"/>
      </g>
      <g fill="${c}" font-size="6.2" letter-spacing=".4"><text x="80" y="80" text-anchor="middle">120</text><text x="18" y="89" transform="rotate(-90 18 89)" text-anchor="middle">72</text><text x="62" y="30">R8</text></g>
      <g fill="${s.text}" font-size="6" letter-spacing=".6"><text x="12" y="18">A-01  ${esc(a.name.toUpperCase())} / ELEVATION</text><path d="M12 22H120" stroke="${s.text}" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="80" y="104" text-anchor="middle" font-size="5.4">GET STARTED</text></g>
    </svg><div class="tbk" style="background:${s.bg}"><span>Sheet A-01</span><span>Rev 2</span><span>Scale 1:1</span><span>Drawn TB</span></div></div>`;
  },
  // A box-drawing frame and a block-letter heading on the character grid; the frame runs off the right edge.
  ascii: (a, _, s) => {
    const A = (t: string) => `<b style="color:${s.accent}">${t}</b>`;
    const rule = "─".repeat(48);
    return `<pre class="as">${[
      `┌─${A(`[ ${esc(a.name.toUpperCase())} ]`)}${rule}`,
      `<span class="fg">│ █▀█ █▀▀ █▀▀ █ █\n│ █▀█ ▀▀█ █   █ █\n│ ▀ ▀ ▀▀▀ ▀▀▀ ▀ ▀</span>`,
      "│",
      ...wrap(`${a.summary.split(":")[0]!}.`, 26).map((l) => `│ ${esc(l)}`),
      "│",
      `│ [${A("x")}] box-drawing frames`,
      "│ [ ] figlet headings",
      `│ ${A("██████████")}░░░░░░ 68%`,
      `└──${rule}`,
    ].join("\n")}</pre>`;
  },
  // Corner brackets, tracked labels, mono readouts and a radar arc bleeding off the right edge.
  hud: (_, __, s) => {
    const c = s.accent;
    return `<div class="hu" style="--c:${c}"><div class="rl"></div><div class="fr"><span class="lb">Telemetry</span><b class="big">98.6<small>%</small></b><span class="lb" style="color:${c}">Signal lock</span><div class="rd"><span>Alt</span><b>12,400</b><span>Hdg</span><b>274°</b><span>Vel</span><b>0.82</b></div></div><svg viewBox="0 0 100 100"><g fill="none" stroke="${c}"><circle cx="50" cy="50" r="48" stroke-opacity=".55" stroke-width="1" vector-effect="non-scaling-stroke"/><circle cx="50" cy="50" r="46.5" stroke-width="2.4" stroke-dasharray=".35 2.6" stroke-opacity=".7"/><circle cx="50" cy="50" r="34" stroke-opacity=".35" stroke-width="1" vector-effect="non-scaling-stroke"/><circle cx="50" cy="50" r="20" stroke-opacity=".35" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M50 2V98M2 50H98" stroke-opacity=".2" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M60 26h-3v3M66 26h3v3M60 35h-3v-3M66 35h3v-3" stroke-width="1" vector-effect="non-scaling-stroke"/></g><path d="M50 50L50 2A48 48 0 0 1 84 16Z" fill="${c}" fill-opacity=".1"/><rect x="61.6" y="29.6" width="1.8" height="1.8" fill="${c}"/><rect x="30" y="62" width="1.4" height="1.4" fill="${c}" fill-opacity=".6"/><text x="70" y="27" font-size="3.2" fill="${c}" font-family="JetBrains Mono, monospace">TGT 04</text></svg></div>`;
  },
  // A real session installing the look's own kit and text effect, with an inverse status line and scanlines.
  prompt: (a, x, s) => {
    const installs = [a.picks["component-kit"]?.[0], a.picks["text-effects"]?.[0]].flatMap((id) => (id && lib(id)?.install) || []);
    return `<div class="tm" style="${x.surf}"><div class="iv" style="background:${s.text};color:${s.surface}">${esc(a.name.toUpperCase())}  tty1</div>${installs
      .map((cmd, i) => `<div class="ls"><b style="color:${s.accent}">$</b> ${esc(cmd)}</div><div class="ls o">added 1 package in 0.${4 - i}s</div>`)
      .join("")}<div class="ls"><b style="color:${s.accent}">$</b> <i class="cur" style="background:${s.text}"></i></div></div>`;
  },
  // An admin table with a toolbar and status badges; every column fits, only rows run off the bottom.
  table: (_, x, s) => {
    const rows: [string, string, boolean][] = [["tanstack-table", "tables", true], ["recharts", "charts", true], ["cmdk", "command", false], ["sonner", "feedback", true], ["radix-ui", "primitives", true]];
    return `<div class="ct" style="${x.surf};border-radius:${Math.min(s.radius, 12)}px"><div class="tool"><span class="q">Search libraries</span><span class="ab" style="${x.btn}">Add library</span></div><div class="hr"><i class="cb"></i><span>Library</span><span>Kind</span><span>Status</span></div>${rows
      .map(([id, k, on]) => {
        const name = lib(id)?.name ?? id;
        return `<div class="r"><i class="cb"></i><span class="n"><i class="av" style="background:${mix(s.accent, 12)};color:${s.accent}">${esc(name[0]!)}</i>${esc(name)}</span><span class="kd">${k}</span><span><em class="bd" style="${on ? `background:${mix(s.accent, 12)};color:${s.accent}` : `background:${mix(s.text, 7)}`}">${on ? "Installed" : "In review"}</em></span></div>`;
      })
      .join("")}</div>`;
  },
  // One big balance with smaller currency and decimals, then a calm transaction list; amounts never truncate.
  ledger: (_, x, s) => {
    const tx: [string, string, string][] = [["Payroll", "Today", "+$8,200.00"], ["AWS", "Yesterday", "−$1,204.18"], ["Transfer to Savings", "Jul 30", "−$2,000.00"], ["Card refund", "Jul 29", "+$64.20"]];
    return `<div class="fl" style="${x.surf};border-radius:${Math.min(s.radius, 16)}px"><span class="lbl">Available balance</span><b class="bal"><small class="cur">$</small>24,812<small>.40</small></b><div class="ac"><span style="${x.btn};border-radius:99px">Send</span><span class="gh">Request</span></div>${tx
      .map(([n, d, amt]) => `<div class="tx"><i class="ic" style="background:${mix(s.accent, 10)};color:${s.accent}">${n[0]}</i><span><b>${n}</b><small>${d}</small></span><b class="amt">${amt}</b></div>`)
      .join("")}</div>`;
  },
  // A 1-bit Finder window: pinstriped title bar, close box, double rule, an inverted selection. The Silkscreen subset covers these words.
  mac: (a, _, s) =>
    `<div class="mc" style="--sf:${s.surface};--tx:${s.text}"><div class="mb" style="background:${s.surface}"><span>File</span><span>Edit</span><span>View</span><span>Special</span></div><div class="wn" style="background:${s.surface};${s.card ?? ""}"><div class="tb"><div class="st"><i class="cl"></i><span>${esc(a.name.split(" (")[0]!)}</span></div></div><div class="inf"><span>3 items</span><span>140K available</span></div><div class="ics"><span class="ic sel"><i></i><em>System Folder</em></span><span class="ic"><i></i><em>Poolsuite</em></span><span class="ic doc"><i></i><em>Read Me</em></span></div></div></div>`,
  // Hard-edged blobs in the look's own background colours, so the uniform frost shows where the card covers them.
  frost: (a, x, s) => {
    const [c1 = s.accent, c2 = c1] = hexes(s.bg);
    return `<div class="fs"><i class="o1" style="background:${c1}"></i><i class="o2" style="background:${c2}"></i><div class="gc" style="${x.tile}"><b>${esc(a.name)}</b><span>Frosted cards over vivid colour</span><div class="pg"><i></i></div><div class="row"><span class="avs"><i></i><i></i><i></i></span><span class="pill" style="${x.btn};border-radius:99px">Join</span></div></div></div>`;
  },
  // A glass tab bar over content: the content is drawn twice, the copy inside the bar magnified (lensing), with the swatch's rims on top.
  lens: (a, _, s) => {
    const [w1 = "", w2 = ""] = a.name.split(" ");
    const [c1 = s.accent, c2 = c1, c3 = c2] = hexes(s.bg);
    const layer = `<div class="lq"><b class="w1">${esc(w1)}</b><b class="w2">${esc(w2)}</b><span class="tl"><i style="background:${s.accent}"></i><i style="background:linear-gradient(135deg,${c2},${c1})"></i><i style="background:${c3}"></i></span></div>`;
    const rim = shadow(s.card);
    return `<div class="lz">${layer}<div class="lp" style="${s.card ?? ""}${rim ? `;--rim:${rim}` : ""}">${layer}<i class="tint" style="background:${s.surface}"></i><span class="tbs"><span class="on"><i style="background:${s.accent}"></i>Home</span><span><i></i>Search</span><span><i></i>Library</span></span></div></div>`;
  },
  // One matte colour, controls extruded from it (the swatch's shadows) or pressed into it (the same shadows inset).
  extrude: (a, _, s) => {
    const up = s.card ?? "", down = `box-shadow:${pressed(s.card)}`;
    return `<div class="nm"><b class="t">${esc(a.name)}</b><span class="s">One matte surface</span><span class="fld" style="${down}">Search</span><span class="tr" style="${down}"><i style="background:${s.accent}"></i></span><span class="bt"><span style="${up}">A</span><span style="${down};color:${s.accent}">B</span></span><span class="kn" style="background:${s.bg};${up}"><i style="${down}"><em style="background:${s.accent}"></em></i></span></div>`;
  },
  // Coloured objects that float off the ground, each with a tinted outer shadow plus inner highlight and shade.
  clay: (a, _, s) => {
    const clay = (c: string) => `background:${c};box-shadow:0 2.6cqw 5cqw ${mix(c, 55)},inset 0 -2cqw 3cqw ${mix(c, 78, "#000")},inset 0 2cqw 2.4cqw rgb(255 255 255/.55)`;
    return `<div class="cy"><i class="b1" style="${clay(s.accent)}"></i><i class="b2" style="${clay(mix(s.accent, 50, s.surface))}"></i><div class="cc" style="background:${s.surface};${s.card ?? ""}"><b>${esc(a.name)}</b><span>Moulded from soft clay</span><span class="cb" style="${clay(s.accent)};color:${s.text}">Let's play</span></div></div>`;
  },
  // Flat, one surface, hairlines, two type sizes and the accent used exactly once.
  quiet: (_, x) =>
    `<div class="mn"><div class="hd"><b>Deployments</b><span class="bt" style="${x.btn}">Deploy</span></div>${[["tastebase", "2m"], ["atlas", "1h"], ["looks", "3d"]].map(([n, t]) => `<div class="r"><i></i><span>${n}</span><span class="m">Ready</span><span class="m">${t}</span></div>`).join("")}</div>`,
  // Elevation by lightness (ground, sidebar, popover), text in three tiers, the accent only on the selected item.
  layers: (_, x, s) =>
    `<div class="dk"><div class="sd"><span>Inbox</span><span class="on">My issues</span><span>Views</span><span>Projects</span></div><div class="ls"><div><span class="t3">TB-12</span><span>Specimen variants</span></div><div><span class="t3">TB-11</span><span>Compare tray</span></div><div><span class="t3">TB-10</span><span class="t2">Atlas islands</span></div></div><div class="pop" style="${x.surf};box-shadow:inset 0 1px 0 rgb(255 255 255/.06),0 4cqw 10cqw rgb(0 0 0/.55)"><div class="in">Type a command…</div><div class="it"><i></i>Assign to…<kbd>A</kbd></div><div class="it on"><i style="background:${s.accent};border-color:${s.accent};opacity:1"></i>Change status<kbd>S</kbd></div><div class="it"><i></i>Set priority<kbd>P</kbd></div></div></div>`,
  // Zero hue: hierarchy from size and inversion; a grey ramp proves there is no accent.
  inverse: (a, _, s) =>
    `<div class="mo"><div class="lbs" style="color:${s.surface}"><span>${esc(a.name)}</span><span>No hue</span></div><div class="pl" style="background:${s.surface};color:${s.text}"><b>${esc(a.name)}</b><div class="ramp">${[0, 20, 40, 60, 80].map((p) => `<i style="background:${mix(s.surface, p, s.text)}"></i>`).join("")}<i style="background:${s.surface};box-shadow:inset 0 0 0 1px ${s.text}"></i></div><div class="btns"><span style="background:${s.text};color:${s.surface}">Read</span><span style="box-shadow:inset 0 0 0 1px ${s.text}">Save</span></div></div></div>`,
  // Soft irregular blobs and a deeply rounded card; curves, not arches or rectangles.
  blob: (a, _, s) =>
    `<div class="og"><i class="b1" style="background:${mix(s.accent, 32, s.bg)}"></i><i class="b2" style="background:${mix(s.accent, 70, s.bg)}"></i><div class="cd" style="background:${s.surface};${s.card ?? ""}"><b>${esc(a.name.split(" /")[0]!)}</b><span>${esc(a.summary.split(";")[0]!)}.</span><span class="pill" style="background:${s.accent};color:${ink(s.accent)}">Begin</span></div></div>`,
  // The pigments the look's colour rule names ("olive #6b7445"), a warm serif and an arch of its greens.
  pigment: (a, _, s) => {
    const p = named(a);
    const g1 = p.olive ?? s.accent, g2 = p.moss ?? g1;
    return `<div class="ea"><b class="h">${esc(a.name.split(" /")[0]!)}</b><span class="arch" style="background:linear-gradient(${g1},${g2})"><i style="background:${mix(g1, 70, s.surface)}"></i><i style="background:${mix(g1, 50, s.surface)}"></i></span><div class="pg">${Object.entries(p)
      .slice(0, 5)
      .map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`)
      .join("")}</div></div>`;
  },
  // Mostly empty oat ground, a wood shelf with two objects, small tracked labels; balance by asymmetry.
  space: (a, _, s) =>
    `<div class="jp"><span class="lb">Oat · Wood · Charcoal</span><span class="lb no">01</span><b class="nm2">${esc(a.name)}</b><i class="hair"></i><i class="shelf" style="background:${s.accent}"></i><i class="bowl" style="background:${s.text}"></i><i class="vase" style="background:${mix(s.accent, 45, s.bg)}"></i></div>`,
  // An uneven open ensō, a torn plaster patch, small loose serif hung left. Nothing is quite straight.
  rough: (a, _, s) =>
    `<div class="ws" style="${s.card ?? ""};border:0"><i class="en" style="border-color:${s.accent};border-right-color:transparent"></i><i class="pp" style="background:${s.surface}"></i><b class="h">${esc(a.name)}</b><span class="s">${esc(a.summary.split(":")[0]!)}</span></div>`,
  // Free-floating flat shapes in the rule's set pairs on lots of white; one word tilted on a colour block.
  confetti: (a, x, s) => {
    const p = named(a), pk = p.pink ?? s.accent, ye = p.yellow ?? s.accent, te = p.teal ?? s.accent, co = p.cobalt ?? s.text;
    return `<div class="cf"><svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice"><path d="M118 22q7-10 14 0t14 0 14 0 14 0 14 0" fill="none" stroke="${pk}" stroke-width="4.5" stroke-linecap="round"/><path d="M12 118l9-9 9 9 9-9 9 9 9-9" fill="none" stroke="${co}" stroke-width="3.2"/><path d="M160 70l26 44h-52z" fill="${ye}"/><circle cx="186" cy="42" r="21" fill="${te}"/><g fill="${s.text}">${[0, 1, 2, 3].flatMap((i) => [0, 1, 2].map((k) => `<circle cx="${148 + i * 6}" cy="${126 + k * 6}" r="1.3"/>`)).join("")}</g><circle cx="28" cy="22" r="9" fill="none" stroke="${s.text}" stroke-width="2.2"/><rect x="90" y="130" width="38" height="9" fill="${pk}" transform="rotate(-18 109 134)"/><path d="M58 136h16v16H58z" fill="${te}"/><g fill="${co}"><path d="M176 8l4 6-6 2z"/><path d="M104 46l3 5-5 1z"/></g></svg><div class="cc" style="${x.surf};border-radius:${s.radius}px"><b class="tilt" style="background:${ye}">${esc(a.name)}</b><span>Shapes, squiggles, dots.</span><span class="bt" style="background:${pk}">Get started</span></div></div>`;
  },
  // A round character with a tiny face and blush, a speech bubble, pastel sparkles and hearts, pill tasks with a cocoa outline.
  cute: (a, x, s) => {
    const p = named(a), pk = p.pink ?? s.accent, lv = p.lavender ?? s.accent, mt = p.mint ?? s.accent, sk = p.sky ?? s.accent, ck = p.cocoa ?? s.text;
    return `<div class="kw"><svg class="deco" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice"><path d="${star(108, 24, 7)}" fill="${lv}"/><path d="${star(188, 70, 5)}" fill="${sk}"/><path d="${star(96, 132, 4)}" fill="${mt}"/><path d="${heart(184, 18, 6)}" fill="${pk}"/><path d="${heart(14, 140, 5)}" fill="${lv}"/></svg><svg class="pal" viewBox="0 0 100 100"><g fill="${s.surface}" stroke="${ck}" stroke-width="3"><circle cx="50" cy="54" r="44"/><ellipse cx="22" cy="20" rx="10" ry="13" transform="rotate(-25 22 20)"/><ellipse cx="78" cy="20" rx="10" ry="13" transform="rotate(25 78 20)"/></g><circle cx="50" cy="54" r="40.5" fill="${s.surface}"/><circle cx="36" cy="52" r="3.6" fill="${ck}"/><circle cx="64" cy="52" r="3.6" fill="${ck}"/><path d="M46 60q4 4 8 0" fill="none" stroke="${ck}" stroke-width="2.4" stroke-linecap="round"/><g fill="${pk}" opacity=".7"><ellipse cx="27" cy="62" rx="6" ry="3.6"/><ellipse cx="73" cy="62" rx="6" ry="3.6"/></g></svg><span class="bub" style="border-color:${ck};background:${s.surface}">All done!</span><div class="tsk" style="${x.surf}"><i style="background:${mt};border-color:${ck}">✓</i><span>Drink water</span></div><div class="tsk two" style="${x.surf}"><i style="border-color:${ck}"></i><span>Pet the cat</span></div><span class="pill" style="background:${pk};border-color:${ck};box-shadow:${shadow(s.card)}">Yay!</span></div>`;
  },
  // Material 3: tonal containers from one seed and no shadows, a filter chip, a list, an extended FAB, a nav bar whose active item is a pill.
  tonal: (_, __, s) => {
    const pc = mix(s.accent, 22, "#fff"), sc = mix(s.accent, 12, "#fff"), hi = mix(s.accent, 9, s.surface), tc = mix("#7d5260", 22, "#fff"); // M3's baseline tertiary
    const g = (d: string) => `<svg viewBox="0 0 24 24"><path d="${d}" fill="currentColor"/></svg>`;
    const home = g("M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"), search = g("M10 4a6 6 0 0 1 4.8 9.6l5 5-1.4 1.4-5-5A6 6 0 1 1 10 4zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z");
    return `<div class="m3"><div class="sb" style="background:${hi}">${search}<span>Search mail</span><i style="background:${tc}">M</i></div><div class="chips"><span class="on" style="background:${sc}">✓ All</span><span>Unread</span><span>Starred</span></div>${[["A", "Your look is ready", "Material You"], ["L", "Seed colour picked", "Tonal palette"]].map(([n, t, d], i) => `<div class="li l${i}"><i style="background:${i ? tc : pc}">${n}</i><span><b>${t}</b><small>${d}</small></span></div>`).join("")}<span class="fab" style="background:${pc}">${g("M4 17.2V20h2.8l9-9-2.8-2.8zM19.7 7.1a1 1 0 0 0 0-1.4l-1.4-1.4a1 1 0 0 0-1.4 0l-1.2 1.2 2.8 2.8z")}Compose</span><div class="nav" style="background:${s.surface}"><span><em style="background:${sc}">${home}</em>Home</span><span><em>${search}</em>Search</span><span><em>${g("M12 3.5l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 17l-5.3 2.9 1.2-6-4.5-4.1 6-.7z")}</em>Saved</span></div></div>`;
  },
  // Flat crisp UI; the depth lives in rendered objects (one light, one material) with soft contact shadows.
  render: (a, x, s) => {
    const c = s.accent, dark = mix(c, 55, "#000");
    const ball = (cl: string) => `background:radial-gradient(circle at 34% 28%,#fff 0,${mix(cl, 40, "#fff")} 14%,${cl} 46%,${mix(cl, 60, "#000")} 100%)`;
    return `<div class="td"><div class="ui" style="${x.surf};border-radius:${Math.min(s.radius, 16)}px"><span class="ey">Daily streak</span><b>${esc(a.name)}</b><span class="sub">120 coins today</span><span class="bt" style="${x.btn}">Collect</span></div><i class="sh s1"></i><i class="orb" style="${ball(c)}"></i><i class="sh s2"></i><span class="cube" style="background:linear-gradient(160deg,${mix(c, 35, "#fff")},${c} 55%,${dark});box-shadow:inset 0 .8cqw 0 rgb(255 255 255/.55),inset 0 -1.6cqw 2cqw ${mix(dark, 70)}"><i style="${ball("#ffffff")}"></i></span><i class="sh s3"></i><i class="coin"></i></div>`;
  },
  // One thick ink outline on everything: clouds, a cel-shaded character, a bubble, a chunky button with a hard drop.
  toon: (a, _, s) => {
    const o = s.text, c = s.accent;
    return `<div class="tn"><svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice"><g fill="${s.surface}" stroke="${o}" stroke-width="3.2" stroke-linejoin="round"><path d="M14 40a10 10 0 0 1 14-12a13 13 0 0 1 24 2a9 9 0 0 1 4 17H18a8 8 0 0 1-4-7z"/><path d="M150 22a8 8 0 0 1 12-9a11 11 0 0 1 20 3a7 7 0 0 1 2 13h-30a7 7 0 0 1-4-7z"/></g><g transform="translate(150 100)"><circle r="40" fill="${c}" stroke="${o}" stroke-width="3.6"/><path d="M-30 26A40 40 0 0 0 38 12A44 44 0 0 1-30 26z" fill="${mix(c, 70, "#000")}"/><g fill="${s.surface}" stroke="${o}" stroke-width="3"><ellipse cx="-12" cy="-10" rx="7" ry="10"/><ellipse cx="10" cy="-10" rx="7" ry="10"/></g><circle cx="-9" cy="-7" r="3.4" fill="${o}"/><circle cx="13" cy="-7" r="3.4" fill="${o}"/><path d="M-14 8q12 14 26 0z" fill="${o}"/><path d="M-30-30l-8-8M-38-14h-10M-24-42l-4-10" stroke="${o}" stroke-width="3" stroke-linecap="round"/></g></svg><span class="bub" style="border-color:${o};background:${s.surface}">Boing!</span><b class="h" style="color:${s.surface};-webkit-text-stroke-color:${o}">${esc(a.name)}</b><span class="bt" style="background:${c};color:${ink(c)};border-color:${o};box-shadow:${shadow(s.card)}">Let's go!</span></div>`;
  },
  // Vibrating complementary rings, the name warped along a wave and swelling in the middle, a calm dark panel for the words.
  warp: (a, _, s) => {
    const p = named(a), m = p.magenta ?? s.accent, l = p.lime ?? s.accent, o = p.orange ?? s.accent, v = p.violet ?? s.surface;
    const letters = [...a.name];
    const size = (i: number) => (18 + 22 * Math.sin((Math.PI * (i + 0.5)) / letters.length)).toFixed(0);
    // Every copy of this specimen draws the same path, so whichever id the browser resolves first is right.
    return `<div class="ps" style="background:repeating-radial-gradient(circle at 92% 108%,${m} 0 5cqw,${o} 5cqw 10cqw,${l} 10cqw 15cqw,${v} 15cqw 20cqw)"><svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice"><path id="wv-${a.id}" d="M8 70C36 34 66 108 104 66S168 34 210 62" fill="none"/><text font-family="Arial Black,Helvetica Neue,sans-serif" font-weight="900" fill="${l}" stroke="${v}" stroke-width="3" paint-order="stroke" letter-spacing="-1"><textPath href="#wv-${a.id}">${letters.map((ch, i) => `<tspan font-size="${size(i)}">${esc(ch)}</tspan>`).join("")}</textPath></text></svg><div class="pn" style="background:${s.surface};${s.card ?? ""}"><b>Fillmore · Sat 9pm</b><span style="background:${s.accent};color:${ink(s.accent)}">Tickets</span></div></div>`;
  },
  // Every inch patterned (stripes, checks, dots, a flower, a sticker), three type voices on a flat panel.
  clash: (_, __, s) => {
    const [pk = s.accent, ye = s.accent] = hexes(s.bg);
    return `<div class="mx"><div class="ck" style="background:repeating-conic-gradient(${s.surface} 0 25%,${ye} 0 50%) 0 0/6cqw 6cqw"></div><div class="dt" style="background:radial-gradient(${s.surface} 22%,transparent 24%) 0 0/4.4cqw 4.4cqw,${s.accent}"></div><div class="p1" style="background:${s.surface};${s.card ?? ""}"><em>More</em><b>IS MORE</b><span>Pattern on pattern, held by a grid.</span></div><svg class="fw" viewBox="-20 -20 40 40"><g fill="${pk}" stroke="${s.surface}" stroke-width="1.4">${[0, 60, 120, 180, 240, 300].map((r) => `<ellipse rx="6" ry="11" cy="-8" transform="rotate(${r})"/>`).join("")}</g><circle r="6" fill="${ye}" stroke="${s.surface}" stroke-width="1.4"/></svg><span class="stk" style="background:${ye};color:${s.surface}">New!</span></div>`;
  },
  // Rough double-stroked boxes, a marker highlight, a hand arrow and a circled note; Caveat only for the notes. Its words are in the font subset.
  sketch: (a, _, s) => {
    const p = named(a), hl = p.highlighter ?? s.accent, cr = p.coral ?? s.accent;
    return `<div class="hw"><svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMin slice"><g fill="none" stroke="${s.text}" stroke-width="1.5" stroke-linecap="round"><path d="${roughBox(14, 18, 150, 118, 7)}"/><path d="${roughBox(30, 98, 62, 20, 11)}"/><path d="${roughBox(30, 74, 9, 9, 3)}"/><path d="M31.5 78.5l3 3.2 6-8.4" stroke-width="2"/></g><path d="M28 52.5c18-1.5 40 1 60-.6" stroke="${hl}" stroke-width="9" stroke-linecap="round" opacity=".85"/><g fill="none" stroke="${cr}" stroke-width="1.7" stroke-linecap="round"><path d="M150 86c-10 12-26 20-48 24M102 110l9.5-.4M102 110l5.6-7.6"/><path d="M186 64c-14-5-40-2-41 7s22 12 36 7 12-14 1-15-22 0-25 2"/></g></svg><b class="nt">${esc(a.name)}</b><span class="bd">Plans, notes, a rough sketch.</span><span class="sk">Sketch it</span><span class="go">Sign up</span><b class="nt note" style="color:${cr}">try me!</b></div>`;
  },
  // Whole windows of lit glass over a room, one floating behind for depth, a side ornament, a grabber bar; selection is brighter glass, never an accent.
  float: (a, _, s) => {
    const glass = `${s.card ?? ""};background:${s.surface}`;
    return `<div class="sv"><i class="rm"></i><i class="win"></i><i class="sofa"></i><i class="lamp"></i><i class="floor"></i><div class="w back" style="${glass}"></div><div class="orn" style="${glass}"><i class="on"></i><i></i><i></i></div><div class="w front" style="${glass}"><b>${esc(a.name.split(" (")[0]!)}</b><span class="sub">Windows in your room</span><span class="well">Search</span><span class="row"><span class="sel">For you</span><span>Library</span><span>Recent</span></span></div><span class="grab"><i class="dot"></i><i></i></span></div>`;
  },
  // Soft blurred ribbons held in the top third over blue-black, stars, a badge and crisp type below the brightest band.
  veil: (a, _, s) => {
    const p = named(a), t = p.teal ?? s.accent, g = p.green ?? t, v = p.violet ?? t;
    return `<div class="au"><i class="rb r1" style="background:${t}"></i><i class="rb r2" style="background:${v}"></i><i class="rb r3" style="background:${g}"></i><i class="stars"></i><span class="tag">Now in beta</span><b class="h">Northern lights<br>for your hero</b><span class="sub">${esc(a.name)} · diffuse, atmospheric</span><span class="bt" style="background:${s.accent};color:${ink(s.accent)}">Get access</span></div>`;
  },
  // One glow behind a prompt box with a 1px gradient border and a lit beam segment, a sparkle chip. Light only, no fills.
  beam: (_, __, s) => {
    const c = s.accent;
    return `<div class="ag"><i class="ray" style="background:linear-gradient(${mix(c, 60)},transparent)"></i><i class="ray r2" style="background:linear-gradient(${mix(c, 35)},transparent)"></i><b class="h">What should we<br>build today?</b><div class="pb" style="background:linear-gradient(${s.surface},${s.surface}) padding-box,linear-gradient(180deg,${mix(c, 80)},rgb(255 255 255/.08) 60%) border-box;box-shadow:${shadow(s.card)}"><i class="lit" style="background:linear-gradient(90deg,transparent,${c},#fff,${c},transparent)"></i><span class="ph">Ask anything…</span><span class="ft"><span class="ch"><svg viewBox="0 0 20 20"><path d="${star(10, 10, 8)}" fill="${c}"/></svg>Deep research</span><span class="ch mono">auto</span><i class="send"></i></span></div></div>`;
  },
  // Striped sun on the horizon, cyan perspective grid, a mountain line, a chrome-gradient italic headline with a pink glow.
  horizon: (a, _, s) => {
    const p = named(a), am = p.amber ?? s.accent, pk = p.pink ?? s.accent, mg = p.magenta ?? pk, cy = p.cyan ?? s.accent, [sky = s.surface] = hexes(s.bg);
    return `<div class="sw"><i class="sun" style="background:linear-gradient(${am},${pk} 60%,${mg})"></i><svg class="mt" viewBox="0 0 200 20" preserveAspectRatio="none"><path d="M0 20L22 8l14 7 20-13 22 18h40l26-15 16 9 20-12 20 18z" fill="${sky}" stroke="${pk}" stroke-width=".6"/></svg><div class="gd"><i style="background-image:linear-gradient(${cy} .7cqw,transparent .7cqw),linear-gradient(90deg,${cy} .5cqw,transparent .5cqw)"></i></div><b class="h" style="background-image:linear-gradient(180deg,#fff 0,${cy} 45%,${sky} 50%,${pk} 56%,#fff 100%);filter:drop-shadow(0 0 1.4cqw ${mix(pk, 80)})">${esc(a.name)}</b></div>`;
  },
  // A clipped-corner panel, an RGB-split heading with one displaced slice, hazard stripes, a barcode, hex IDs and scanlines. Static.
  glitch: (a, x, s) => {
    const p = named(a), y = p.yellow ?? s.accent, m = p.magenta ?? s.accent, c = p.cyan ?? s.accent;
    const word = esc(a.name.toUpperCase());
    return `<div class="cp"><i class="haz" style="background:repeating-linear-gradient(-45deg,${y} 0 2.4cqw,${s.bg} 2.4cqw 4.8cqw)"></i><div class="pnl" style="${x.surf}"><span class="id" style="color:${c}">NETRUNNER // 0x2F7A</span><b class="gl" style="text-shadow:-.7cqw 0 ${m},.7cqw 0 ${c}">${word}<span style="color:${y}">${word}</span></b><span class="ln">Signal lost in sector 7. Rerouting.</span><span class="bt" style="background:${y};color:${s.bg}">Jack in</span></div><i class="bc"></i><span class="hx" style="color:${m}">ERR_0451 · 3F:9A:C2</span><i class="scan"></i></div>`;
  },
  // One tilted foil card (the swatch's spectrum) with a glare and a diagonal sheen on a neutral ground.
  foil: (a, _, s) =>
    `<div class="ho"><span class="cap">One foil object per view</span><div class="cd" style="${s.card ?? ""}"><i class="gl"></i><i class="chip"></i><span class="no">HOLO · 001/250</span><b>${esc(a.name)}</b><span class="fn">Iridescent foil</span></div></div>`,
  // The colour rule's metal ramp on one huge word and a liquid blob, a pill with a chrome rim. No hue.
  metal: (a, _, s) => {
    const ramp = a.colour.match(/linear-gradient\([^)]*\)/)?.[0] ?? `linear-gradient(180deg,#fff,${s.accent} 40%,#111 50%,#e5e7eb 62%,${s.accent})`;
    const word = a.name.split(" ").at(-1)!.replace(/^./, (c) => c.toUpperCase());
    return `<div class="cr"><i class="blob" style="background:radial-gradient(circle at 36% 26%,#fff 0,#e5e7eb 12%,transparent 28%),${ramp}"></i><b class="w" style="background-image:${ramp}">${esc(word)}</b><span class="sub">Polished liquid metal</span><span class="bt" style="${s.card ?? ""}">Enter</span></div>`;
  },
  // One centred promise with a badge, two CTAs, a logo strip of the look's own picks, the product rising off the bottom edge.
  hero: (a, x, s) => {
    const logos = [a.picks["component-kit"], a.picks.tables, a.picks.editor, a.picks.command, a.picks.feedback].flatMap((ids) => ids ?? []).slice(0, 5).map((id) => lib(id)?.name ?? id);
    const voices = ["font:600 3.1cqw var(--font-sans)", "font:italic 400 3.6cqw var(--font-serif)", "font:500 2.8cqw var(--font-mono)", "font:700 3cqw var(--font-sans);letter-spacing:-.04em", "font:600 2.9cqw var(--font-sans);text-transform:uppercase;letter-spacing:.06em"];
    return `<div class="sm"><div class="nv"><b><i style="${x.acc}"></i>Acme</b><span>Product</span><span>Pricing</span><span>Customers</span><span class="cta" style="${x.btn}">Start free</span></div><span class="badge"><em style="color:${s.accent}">New</em> Changelog 4.0 →</span><b class="h">Ship the product,<br>skip the setup.</b><span class="sub">${esc(a.summary.split(":")[0]!)}.</span><span class="ctas"><span style="${x.btn}">Start free</span><span class="gh">Book a demo</span></span><div class="lg">${logos.map((n, i) => `<span style="${voices[i % voices.length]}">${esc(n)}</span>`).join("")}</div><div class="shot" style="${x.surf}"><span class="lt"><i></i><i></i><i></i></span><i class="side"></i><i class="bl" style="${x.acc}"></i><i class="bl b2"></i><i class="bl b3"></i></div></div>`;
  },
  // Three panes at three depths over one crisp word; the blur grows with distance, so depth is the hierarchy.
  panes: (a, _, s) => {
    const [c1 = s.accent] = hexes(s.bg);
    return `<div class="zgp" style="--sf:${s.surface};--fb:${mix(c1, 82)}"><b class="bk">${esc(a.name)}</b><i class="dot"></i><div class="pn p3"><span class="ey">09:00</span><b>Standup</b></div><div class="pn p2"><span class="ey">Messages · now</span><b>Depth carries hierarchy</b></div><div class="pn p1"><span class="ey">Now playing</span><b>Translucent</b><span class="tr"><i style="width:62%"></i></span><span class="ctl">${glyph("M7 5v14l11-7z")}</span></div></div>`;
  },
  // A sheet that followed the finger over the page it stepped back from, a segmented control, two toggles.
  sheet: (_, __, s) =>
    `<div class="zap" style="background:${s.text}"><div class="under" style="background:${s.bg}"><b>Library</b>${[70, 52, 64].map((w) => `<i style="width:${w}%"></i>`).join("")}</div><div class="sh" style="background:${s.surface}"><i class="grab"></i><div class="hd"><span style="color:${s.accent}">Cancel</span><b>New look</b><span style="color:${s.accent};font-weight:600">Done</span></div><div class="sg" style="background:${mix(s.text, 7)}"><span class="on" style="background:${s.surface}">Springs</span><span>Sheets</span><span>Materials</span></div><div class="grp" style="background:${s.bg}"><span class="r"><span>Follow the finger</span><i class="tg" style="background:${s.accent}"><i></i></i></span><span class="r"><span>Native feel</span><i class="tg off"><i></i></i></span></div></div></div>`,
  // iOS Settings: status bar, a 34pt large title, search and an inset grouped list with system-colour icon squares.
  grouped: (_, __, s) => {
    const row = (c: string, icon: string, label: string, end: string) => `<span class="r"><i class="ic" style="background:${c}">${icon}</i><span class="lb">${label}</span>${end}</span>`;
    const chev = (v: string) => `<em class="vl">${v}</em>${outline("M9 6l6 6-6 6", "chev")}`;
    // System orange and green: the rule says system colours, never custom ones.
    return `<div class="zio"><div class="stb"><b>9:41</b><span class="sgl"><i></i><i></i><i></i><i></i></span><i class="bat"></i></div><b class="lt">Settings</b><span class="srch">${outline("M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.6-4.6")}Search</span><div class="grp" style="background:${s.surface}">${[
      row("#ff9500", glyph("M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"), "Airplane Mode", `<i class="tg"><i></i></i>`),
      row(s.accent, outline("M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"), "Wi-Fi", chev("Home")),
      row(s.accent, outline("M7 7l10 10-5 5V2l5 5L7 17"), "Bluetooth", chev("On")),
      row("#34c759", outline("M5 20v-4M10 20v-8M15 20v-12M20 20V4"), "Cellular", chev("")),
    ].join("")}</div></div>`;
  },
  // A finished lesson: a fat progress bar, stat tiles in hard coloured frames, a 3D button standing on its own shadow.
  chunky: (_, __, s) => {
    // shortcut: playful's colour rule names no hues, so the gold and blue tiles are literal; read them from the rule once it names them.
    const tile = (c: string, k: string, v: string) => `<span class="tl" style="border-color:${c};background:${c}"><em>${k}</em><b style="color:${c};background:${s.surface}">${v}</b></span>`;
    return `<div class="zpl"><div class="prog"><i>✕</i><span class="pbar" style="background:${mix(s.text, 10)}"><i style="background:${s.accent}"></i></span></div><b class="h">Lesson complete!</b><div class="st">${tile("#ffc800", "Total XP", "15")}${tile("#1cb0f6", "Streak", "7 days")}${tile(s.accent, "Accuracy", "98%")}</div><span class="go" style="background:${s.accent};color:#fff;box-shadow:0 1cqw 0 ${mix(s.accent, 68, "#000")}">Continue</span></div>`;
  },
  // Light as the material: a bent-tube word with its clips and reflection, a glowing meter and an outline button.
  tube: (a, _, s) => {
    const c = s.accent, word = esc(a.name.split(" ")[0]!.toUpperCase());
    return `<div class="zne"><i class="glow"></i><b class="tb" style="-webkit-text-stroke-color:${mix(c, 45, "#fff")};filter:drop-shadow(0 0 .5cqw ${c}) drop-shadow(0 0 2.4cqw ${c})">${word}</b><b class="tb rf" style="-webkit-text-stroke-color:${c}">${word}</b><span class="clips"><i></i><i></i><i></i></span><div class="cd" style="background:${s.surface};${s.card ?? ""}"><span class="ey" style="color:${c}">Level 42</span><span class="m"><i style="background:${c};box-shadow:0 0 1.6cqw ${c}"></i></span><span class="bt" style="border-color:${c};color:${c};box-shadow:0 0 2cqw ${mix(c, 60)},inset 0 0 1.4cqw ${mix(c, 40)}">Play now</span></div></div>`;
  },
  // Black, ivory and one metal: spaced caps, one lit product in the dark, a huge fine serif, an underlined link.
  maison: (a, _, s) =>
    `<div class="zlx" style="--a:${s.accent}"><div class="nv"><span>Women</span><b>MAISON</b><span>Men</span></div><div class="ph" style="border-color:${mix(s.accent, 40)};background:radial-gradient(ellipse 65% 50% at 50% 42%,${mix(s.accent, 25, s.bg)} 0,${mix(s.accent, 7, s.bg)} 55%,${s.bg} 100%)"><i class="bottle"><i class="cap" style="background:linear-gradient(90deg,${mix(s.accent, 60, "#000")},${s.accent} 45%,${mix(s.accent, 50, "#fff")} 60%,${mix(s.accent, 70, "#000")})"></i></i></div><b class="w">${esc(a.name)}</b><span class="cap2">The Autumn Collection</span><span class="lk2" style="border-color:${s.accent}">Discover</span></div>`,
  // No logo, small refined type, muted product tiles in the rule's stone and camel; the price is the loudest thing and it is tiny.
  boutique: (a, _, s) => {
    const p = named(a), stone = p.stone ?? s.surface, camel = p.camel ?? s.accent;
    const sweater = "M13 7l4-2q3 2.6 6 0l4 2 8 8-3.6 3.6-3.4-3V35H12V15.6l-3.4 3L5 15z", tote = "M9 15h22l2 20H7zM15 15v-3a5 5 0 0 1 10 0v3h-2v-3a3 3 0 0 0-6 0v3z";
    const item = (bg: string, fill: string, d: string, n: string, pr: string) => `<span class="it"><span class="ph" style="background:${bg}"><svg viewBox="0 0 40 40"><path d="${d}" fill="${fill}"/></svg></span><span class="n">${n}</span><span class="pr">${pr}</span></span>`;
    return `<div class="zql"><div class="nv"><span>Women</span><span>Men</span><b>ATELIER</b><span>Search</span><span>Bag</span></div><b class="h">Autumn essentials</b><div class="gd">${item(mix(stone, 60, s.bg), mix(camel, 55, stone), sweater, "Cashmere crewneck", "€ 1,250")}${item(mix(camel, 30, s.bg), mix(s.accent, 70, camel), tote, "Leather tote", "€ 2,400")}${item(stone, mix(s.text, 22, stone), sweater, "Merino polo", "€ 690")}</div></div>`;
  },
  // A glossy mesh in a skewed band over white, navy type below it, a deep-shadow card across the seam.
  mesh: (a, x, s) =>
    `<div class="zmg" style="background:${s.surface}"><i class="fl" style="background:${s.bg}"></i><div class="nv"><b>Acme</b><span>Products</span><span>Pricing</span></div><b class="h">${esc(a.name)}</b><span class="bt" style="${x.btn};border-radius:99px">Start now ›</span><div class="cd" style="${x.surf};border-radius:${s.radius}px"><span class="ey">Net volume</span><b>$3,528.20</b><svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 26L12 22 24 24 36 15 48 18 60 9 72 12 84 5 100 3" fill="none" stroke="${s.accent}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg></div></div>`,
  // A muted blend under heavy film grain, a loupe that proves the grain, small text only on the solid card.
  grain: (a, x, s) =>
    `<div class="zgg"><i class="g2"></i><b class="h">${esc(a.name)}</b><span class="loupe" style="background:${s.bg.match(/(?:linear|radial)-gradient\(.*\)/)?.[0] ?? s.surface}"><i></i><em>×4</em></span><div class="cd" style="${x.surf};border-radius:${s.radius}px"><span class="ey">Film grain · 12%</span><b>Tactile and analog</b><span class="bt" style="${x.btn}">Listen</span></div></div>`,
  // One pale tint per category from the rule, ink text on all of them, one mid accent for the action.
  tints: (a, _, s) => {
    const p = named(a);
    const tiles: [string, string, string, string][] = [
      [p.lavender ?? s.surface, "Focus", "3 tasks", "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
      [p.peach ?? s.surface, "Rest", "8h sleep", "M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"],
      [p.mint ?? s.surface, "Move", "4,200 steps", "M13 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM9 21l2-7 2 2v5h2v-6l-2-3 1-3 2 2h3v-2h-2l-3-3h-3L8 11v3h2v-2z"],
      [p.sky ?? s.surface, "Read", "20 pages", "M4 5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a2 2 0 0 0-2 1 2 2 0 0 0-2-1H4z"],
    ];
    return `<div class="zsp"><span class="ey">Tuesday</span><b class="h">Good morning</b><div class="gd">${tiles.map(([c, n, v, d]) => `<span class="t" style="background:${c}">${glyph(d)}<b>${n}</b><span>${v}</span></span>`).join("")}</div><span class="bt" style="background:${s.accent};color:${ink(s.accent)}">Plan my day</span></div>`;
  },
  // Daylight across warm white, a sentence-case product page, the finishes as material swatches with the oak grain first.
  finish: (a, x, s) => {
    const oak = named(a).oak ?? s.surface;
    const grain = `repeating-linear-gradient(100deg,${oak} 0 1.2cqw,${mix(oak, 85, "#8a6a45")} 1.2cqw 1.5cqw,${oak} 1.5cqw 2.6cqw)`;
    return `<div class="zsc" style="--g:${s.bg}"><i class="sun"></i><div class="pv"><svg viewBox="0 0 100 80"><g stroke="${mix(oak, 70, "#7a5a35")}" stroke-width="2.4" stroke-linecap="round"><path d="M30 52L22 76M70 52L78 76M36 52l-2 22M64 52l2 22"/></g><rect x="22" y="40" width="58" height="13" rx="6" fill="${mix(s.accent, 72, "#fff")}"/><path d="M26 42L34 10Q36 6 40 6h20q4 0 3 4L58 42z" fill="${mix(s.accent, 85, "#fff")}"/></svg></div><span class="crumb">Living room / Chairs</span><b class="h">Lounge chair</b><span class="pr">4 990 kr</span><span class="lb">Finish: <b>Light oak</b></span><span class="fin"><i class="on" style="background:${grain}"></i><i style="background:#f1ece4"></i><i style="background:${s.text}"></i><i style="background:${s.accent}"></i></span><span class="bt" style="${x.btn}">Add to cart</span></div>`;
  },
  // A window on the city at night, one warm lamp, a quiet player in small lowercase, grain over everything.
  night: (a, _, s) => {
    const p = named(a), amber = p.amber ?? s.accent, mauve = p.mauve ?? s.surface;
    const city = [[0, 30], [10, 22], [18, 34], [30, 18], [40, 28], [52, 14], [62, 26], [74, 20], [86, 32], [94, 24]].map(([x0, h = 0]) => `<rect x="${x0}" y="${60 - h}" width="10" height="${h}"/>`).join("");
    const lit = [[4, 36], [13, 42], [22, 32], [33, 46], [35, 50], [44, 38], [55, 50], [57, 54], [66, 40], [77, 46], [88, 34], [97, 42]].map(([x0, y0]) => `<rect x="${x0}" y="${y0}" width="2" height="2" fill="${amber}"/>`).join("");
    return `<div class="zlf" style="--m:${mauve}"><div class="win"><svg viewBox="0 0 108 60" preserveAspectRatio="xMidYMax slice"><circle cx="84" cy="14" r="6" fill="${p.peach ?? amber}"/><g fill="${s.text}" opacity=".7"><circle cx="20" cy="10" r=".6"/><circle cx="46" cy="6" r=".5"/><circle cx="62" cy="16" r=".6"/><circle cx="102" cy="26" r=".5"/></g><g fill="${hexes(s.bg)[0] ?? s.surface}">${city}</g>${lit}</svg></div><i class="lamp" style="background:radial-gradient(closest-side,${mix(amber, 55)},transparent)"></i><div class="plr" style="background:${s.surface};${s.card ?? ""}"><span class="ey">study beats · 2 a.m.</span><b>rain on the window</b><span class="pr"><i style="background:${amber}"></i></span><span class="ctl">${glyph("M6 6h2v12H6zM9.5 12L18 6v12z")}${glyph("M8 5h3v14H8zM13 5h3v14h-3z", "pp")}${glyph("M16 6h2v12h-2zM14.5 12L6 18V6z")}</span></div><i class="noise"></i></div>`;
  },
  // A gingham band with a scalloped edge, sprigs of blush flowers, a soft serif recipe card in cream.
  gingham: (a, _, s) => {
    const p = named(a), sage = p.sage ?? s.accent, blush = p.blush ?? s.accent, butter = p.butter ?? s.surface, berry = p.berry ?? s.text, moss = p.moss ?? s.text;
    const flower = (cx: number, cy: number, r: number) =>
      `<g transform="translate(${cx} ${cy})"><path d="M${-r * 2.4} ${r * 1.6}q${r} ${-r * 2} ${r * 2.2} ${-r * 0.6}M${r * 1.2} ${r * 1.4}q${r * 0.8} ${-r * 1.6} ${r * 2.4} ${-r * 0.4}" stroke="${moss}" stroke-width="${r * 0.35}" fill="none"/><ellipse cx="${-r * 1.7}" cy="${r * 1.1}" rx="${r * 0.9}" ry="${r * 0.4}" fill="${sage}" transform="rotate(-30 ${-r * 1.7} ${r * 1.1})"/>${[0, 72, 144, 216, 288].map((d) => `<ellipse cy="${-r * 0.75}" rx="${r * 0.55}" ry="${r * 0.8}" fill="${blush}" transform="rotate(${d})"/>`).join("")}<circle r="${r * 0.45}" fill="${butter}"/></g>`;
    return `<div class="zct"><i class="gh" style="--g:${mix(sage, 45)}"></i><svg class="fw" viewBox="0 0 200 150" preserveAspectRatio="xMidYMin slice">${flower(22, 52, 6)}${flower(176, 48, 7)}${flower(150, 58, 4)}${flower(44, 60, 3.6)}</svg><div class="cd" style="background:${s.surface};${s.card ?? ""};border-radius:${s.radius}px"><span class="ey">From the garden</span><b class="h">Elderflower cordial</b><span class="sub">Makes two jars · 20 minutes</span><span class="row"><span class="bt" style="background:${sage};color:${ink(sage)}">Save recipe</span><svg viewBox="-10 -10 20 20" class="ht"><path d="${heart(0, 0, 7)}" fill="${berry}"/></svg></span></div></div>`;
  },
  // Fluent 2: neutral chrome in the rule's greys, a rail whose selection is a brand-blue pill, 4px corners, an Acrylic flyout over the chat.
  flyout: (_, __, s) => {
    const rail: [string, boolean][] = [["M4 5h16v11H9l-5 4z", true], ["M4 6h16v13H4zM4 10h16M9 3v4M15 3v4", false], ["M7 4h7l4 4v12H7zM14 4v4h4", false]];
    const chats: [string, string][] = [["Ada Fischer", "Sounds good, ship it"], ["Design crit", "Kim: Fluent tokens are in"], ["Lin Park", "See you at 3"]];
    const items: [string, string, string][] = [["M4 6h16v10H8l-4 4z", "Reply", "Ctrl+R"], ["M14 5l7 7-7 7M21 12H8a5 5 0 0 0-5 5v1", "Forward", "Ctrl+F"], ["M9 3h6l-1 6 4 3H6l4-3zM12 12v9", "Pin", ""], ["M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13", "Delete", "Del"]];
    return `<div class="zfl"><div class="rail">${rail.map(([d, on]) => `<span${on ? ` class="on"` : ""}>${on ? `<i style="background:${s.accent}"></i>` : ""}${outline(d)}</span>`).join("")}</div><div class="ls" style="background:${s.bg}"><div class="hd"><b>Chat</b><span class="nb" style="background:${s.accent}">New chat</span></div>${chats
      .map(([n, m], i) => `<span class="it${i ? "" : " on"}"><i class="av">${n.split(" ").map((w) => w[0]).join("")}</i><span><b>${n}</b><small>${m}</small></span></span>`)
      .join("")}</div><div class="cv"><span class="msg">Can you review the flyout?</span><span class="msg me" style="background:${mix(s.accent, 14, "#fff")}">On it, sending notes now</span></div><div class="acr">${items
      .map(([d, l, k], i) => `${i === 3 ? `<i class="dv"></i>` : ""}<span class="mi${i ? "" : " hv"}">${outline(d)}<span>${l}</span><kbd>${k}</kbd></span>`)
      .join("")}</div></div>`;
  },
  // Material 2: an elevated primary app bar, a 1dp card with uppercase text buttons and a frozen ink ripple, a 6dp FAB in the secondary.
  paper: (a, _, s) => {
    const secondary = hexes(a.colour)[1] ?? s.accent;
    return `<div class="zmd"><div class="ab" style="background:${s.accent}">${glyph("M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z")}<b>Inbox</b>${glyph("M10 4a6 6 0 0 1 4.8 9.6l5 5-1.4 1.4-5-5A6 6 0 1 1 10 4zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z")}</div><div class="cd" style="background:${s.surface};${s.card ?? ""}"><span class="ov">Paper · 1dp</span><b>${esc(a.name)}</b><span class="tx">Paper surfaces at shadow elevations, a bold primary and ink ripples.</span><span class="ac" style="color:${s.accent}"><span>Share</span><span class="rp">Learn more<i style="background:radial-gradient(circle,${mix(s.accent, 22)} 0 60%,transparent 62%)"></i></span></span></div><span class="fab" style="background:${secondary}">${glyph("M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z")}</span></div>`;
  },
  // One result in plain words, status as colour plus icon plus text, a range bar with zones, one big calm action.
  vitals: (_, __, s) =>
    // The amber and red zones are status colours, never the look's accent.
    `<div class="zhc"><span class="ey">Your results · Updated today</span><div class="cd" style="background:${s.surface};${s.card ?? ""};border-radius:${s.radius}px"><span class="hd"><b>Cholesterol</b><span class="st">${glyph("M12 3l10 18H2zm-1 7v5h2v-5zm0 7v2h2v-2z")}A little high</span></span><span class="v"><b>5.6</b> mmol/L</span><span class="rg"><i style="background:${s.accent}"></i><i style="background:#d99a1e"></i><i style="background:#c2412d"></i><em style="left:58%"></em></span><span class="rl"><span>Healthy</span><span>Borderline</span><span>High</span></span><span class="pl">Slightly above the healthy range. Your doctor will talk it through.</span><span class="bt" style="background:${s.accent};color:${ink(s.accent)};border-radius:${Math.min(s.radius, 10)}px">Book a follow-up</span></div><div class="cd c2" style="background:${s.surface};${s.card ?? ""};border-radius:${s.radius}px"><b>Blood pressure</b><span class="ok" style="color:${s.accent}">${glyph("M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z")}Healthy</span></div></div>`,
  // Solid tiles in the rule's five flat colours, filled glyphs, and no shadow, gradient or texture anywhere.
  tiles: (a, _, s) => {
    const p = named(a);
    const t: [string, string, string, boolean?][] = [
      [p.turquoise ?? s.accent, "Mail", `${glyph("M3 6h18v12H3zm1.5 1.5L12 13l7.5-5.5")}<b class="n">3</b>`, true],
      [p.blue ?? s.accent, "Calendar", `<b class="big">14</b>`],
      [p.amethyst ?? s.accent, "Photos", glyph("M4 7h4l2-2h4l2 2h4v12H4zm8 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z")],
      [p.red ?? s.accent, "Music", glyph("M9 4h11v12.5a2.5 2.5 0 1 1-2-2.45V8h-7v10.5A2.5 2.5 0 1 1 9 16z")],
      [p.sunflower ?? s.accent, "Weather", `${glyph("M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3z")}<b class="n">21°</b>`, true],
      [s.text, "Store", glyph("M5 8h14l-1.2 12H6.2zM9 8V7a3 3 0 0 1 6 0v1h-2V7a1 1 0 0 0-2 0v1z")],
    ];
    return `<div class="zft"><b class="h">Start</b><div class="gd">${t.map(([c, l, inner, wide]) => `<span class="t${wide ? " w2" : ""}" style="background:${c};color:${ink(c)}">${inner}<span>${l}</span></span>`).join("")}</div></div>`;
  },
  // Chrome bubble lettering from the rule's own ramp, candy gel buttons with a gloss, bubbles and sparkles on silver.
  gel: (a, _, s) => {
    const p = named(a), ice = p.ice ?? p.blue ?? s.surface, pink = p.pink ?? s.accent, lime = p.lime ?? s.accent;
    const chrome = a.colour.match(/linear-gradient\([^)]*\)/)?.[0] ?? `linear-gradient(#fff,${s.text})`;
    const gel = (c: string) => `background:linear-gradient(${mix(c, 55, "#fff")},${c} 55%,${mix(c, 80, "#000")});box-shadow:inset 0 -.8cqw 1.4cqw ${mix(c, 60, "#fff")},0 .8cqw 1.6cqw ${mix(c, 45)}`;
    return `<div class="zy2"><i class="bub b1"></i><i class="bub b2"></i><i class="bub b3"></i><svg class="spk" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice"><path d="${star(170, 24, 9)}" fill="${pink}"/><path d="${star(152, 46, 4)}" fill="#fff"/><path d="${star(22, 128, 6)}" fill="${lime}"/><path d="${star(108, 18, 3)}" fill="#fff"/></svg><b class="ch" style="--chrome:${chrome}">Y2K</b><span class="sub">Welcome to the new millennium</span><span class="btns"><span class="gl" style="${gel(ice)};color:${s.text}">Enter site</span><span class="gl" style="${gel(pink)};color:#fff">Sign guestbook</span></span></div>`;
  },
  // A game screen in one fixed 16-colour palette: pixel hearts and score, a chest and coins, a stepped-border dialog. Silkscreen subset covers its words.
  sprite: (_, __, s) => {
    const P = { r: "#b13e53", o: "#ef7d57", y: s.accent, w: s.text, g: "#38b764", t: "#257179", k: "#333c57", n: "#29366f" }; // Sweetie 16, which the rule names
    const hrt = [".rr.rr.", "rwrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."];
    const chest = [".rrrrrrrr.", "roooooooor", "roooooooor", "rrrryyrrrr", "rooowyooor", "roooyyooor", "roooooooor", "rrrrrrrrrr"];
    const coin = [".yy.", "ywyy", "ywyo", "ywyo", ".oo."];
    // Grass, then brick-coursed earth: mortar every third row and every eighth column, offset per course.
    const earth = ["g".repeat(64), "g".repeat(64), ...Array.from({ length: 12 }, (_, y) => Array.from({ length: 64 }, (_, x) => (y % 3 === 2 || (x + (Math.floor(y / 3) % 2) * 4) % 8 === 0 ? "n" : "t")).join(""))];
    return `<div class="zpx"><svg class="hp" viewBox="0 0 23 6" shape-rendering="crispEdges">${sprite(hrt, P)}${sprite(hrt, P, 8)}${sprite(hrt.map((r) => r.replace(/[rw]/g, "k")), P, 16)}</svg><svg class="scn" viewBox="0 0 64 48" shape-rendering="crispEdges">${sprite(chest, P, 27, 26)}${sprite(coin, P, 40, 22)}${sprite(coin, P, 45, 28)}${sprite(coin, P, 22, 24)}${sprite(earth, P, 0, 34)}</svg><span class="sc">SCORE 004200</span><div class="dl" style="background:${s.surface};${s.card ?? ""}">YOU FOUND 3 COINS<b style="color:${s.accent}">▶</b></div></div>`;
  },
  // A lit sphere rebuilt from 1-bit Bayer dots at build time; the type beside it stays solid.
  bayer: (a, _, s) =>
    `<div class="zdt" style="background:${s.surface}"><svg viewBox="0 0 80 60" shape-rendering="crispEdges" preserveAspectRatio="xMaxYMid slice">${dots}</svg><div class="cd" style="background:${s.surface};${s.card ?? ""}"><span class="ey">1-bit · 4×4 Bayer</span><b>${esc(a.name)}</b><span class="tx">Ordered dots, solid type.</span></div></div>`,
  // A rainbow arch, wavy stripes and a sunburst in the rule's earth colours, a fat soft serif with a stacked echo.
  rainbow: (a, _, s) => {
    const p = named(a), mu = p.mustard ?? s.accent, or = p.orange ?? s.accent, br = p.brick ?? s.text, av = p.avocado ?? s.text;
    const wave = (y: number, c: string) => `<path d="M-5 ${y}q12.5-9 25 0t25 0 25 0 25 0 25 0 25 0 25 0 25 0 25 0" stroke="${c}" stroke-width="5" fill="none"/>`;
    return `<div class="zgr"><i class="burst" style="background:repeating-conic-gradient(from 0deg at 100% 100%,${mix(mu, 22)} 0 4deg,transparent 4deg 9deg)"></i><i class="arch" style="background:radial-gradient(circle at 50% 100%,${s.bg} 0 24%,${av} 24% 36%,${mu} 36% 48%,${or} 48% 60%,${br} 60% 72%,transparent 72%)"></i><svg class="wv" viewBox="0 0 200 30" preserveAspectRatio="none">${wave(8, mu)}${wave(15, or)}${wave(22, br)}</svg><b class="h" style="color:${s.text};-webkit-text-stroke:.5cqw ${s.text};text-shadow:.7cqw .7cqw 0 ${mu},1.4cqw 1.4cqw 0 ${or},2.1cqw 2.1cqw 0 ${br}">Groovy</b><span class="sub">Warm, round and wavy</span><span class="bt" style="background:${or};color:${ink(or)}">Get down</span></div>`;
  },
  // Torn fragments with paper edges and contact shadows, a cut-paper disc, two clashing voices, one clean panel.
  cutout: (_, __, s) =>
    // The fragments stand in for found photographs (a sky, a halftone), so they keep their own colours.
    `<div class="zcl"><i class="disc" style="background:${s.accent}"></i><span class="fr f1"><i><i style="background:linear-gradient(180deg,#5b8fc9,#a9c9e8 60%,#e9dcc2 61%,#c9b48f)"></i></i></span><span class="fr f2"><i><i style="background:radial-gradient(circle,${s.text} 34%,transparent 37%) 0 0/1.6cqw 1.6cqw,${mix(s.accent, 55, "#fff")}"></i></i></span><span class="fr f3"><i><b>CUT</b></i></span><em class="it">&amp; paste</em><div class="pnl" style="background:${s.surface}">Found imagery at clashing scales, with calm space around it.</div></div>`,
  // A taped snapshot, die-cut stickers with white outlines, a typed label and one handwritten note (Caveat subset).
  tape: (_, __, s) => {
    // shortcut: the rule names one recurring hue; the yellow and teal stickers are literal until the rule names them.
    const sticker = (d: string, c: string) => `<path d="${d}" fill="${c}" stroke="#fff" stroke-width="3" paint-order="stroke" stroke-linejoin="round"/>`;
    return `<div class="zsb"><span class="pol"><i style="background:linear-gradient(180deg,#ffb38a,${s.accent} 55%,#7a3b5e)"></i><i class="tp" style="background:repeating-linear-gradient(45deg,${mix(s.accent, 45)} 0 1.2cqw,${mix(s.accent, 25)} 1.2cqw 2.4cqw)"></i></span><svg class="st" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice"><g style="filter:drop-shadow(0 1.5px 2px rgb(43 33 24/.3))">${sticker(star(160, 34, 17).replace(/Q/g, "L"), "#ffd23f")}${sticker(heart(176, 104, 12), s.accent)}<circle cx="134" cy="82" r="15" fill="#2ec4b6" stroke="#fff" stroke-width="3"/></g><text x="134" y="85" text-anchor="middle" font-size="7" font-weight="700" fill="#fff">100%</text></svg><span class="lbl">JULY 14</span><b class="nt">best day ever!</b><svg class="ar" viewBox="0 0 40 20"><path d="M2 4c10 12 22 12 34 6M36 10l-6-1M36 10l-3 5" fill="none" stroke="${s.text}" stroke-width="1.4" stroke-linecap="round"/></svg></div>`;
  },
  // A fluorescent starburst, a chrome word stretched to breaking, and the one solid, undistorted panel with the logistics.
  flyer: (a, _, s) => {
    const p = named(a), gr = p.green ?? s.accent, pk = p.pink ?? s.accent, bl = p.blue ?? s.accent;
    const spikes = Array.from({ length: 36 }, (_, i) => {
      const r = i % 2 ? 22 : 46, t = (i * Math.PI) / 18;
      return `${(50 + r * Math.cos(t)).toFixed(1)},${(50 + r * Math.sin(t)).toFixed(1)}`;
    }).join(" ");
    return `<div class="zac"><svg class="bs" viewBox="0 0 100 100"><polygon points="${spikes}" fill="${gr}"/></svg><i class="hoop" style="border-color:${pk}"></i><i class="hoop h2" style="border-color:${bl}"></i><b class="cw">ACID</b><b class="ol" style="-webkit-text-stroke-color:${pk}">RAVE</b><div class="pnl" style="background:${s.surface}"><b>SAT 23 NOV</b><span>23:00 – 06:00</span><span>Warehouse 9</span><span class="pr" style="color:${gr}">£12 ADV</span></div></div>`;
  },
  // A pause menu with the selected row in clipped corners, stat bars in fixed semantic colours, button prompts.
  loadout: (_, __, s) => {
    const clip = "clip-path:polygon(0 0,calc(100% - 2.4cqw) 0,100% 2.4cqw,100% 100%,2.4cqw 100%,0 calc(100% - 2.4cqw))";
    const bar = (k: string, v: string, w: number, c: string) => `<span class="sb"><span class="lb"><span>${k}</span><b>${v}</b></span><span class="tr"><i style="width:${w}%;background:${c}"></i></span></span>`;
    // Health red, shield blue, XP gold: the rule fixes them by meaning, not by look.
    return `<div class="zgm"><div class="menu">${["Resume", "Loadout", "Settings", "Quit"].map((m) => (m === "Loadout" ? `<span class="on" style="${clip};background:${mix(s.accent, 22)};box-shadow:inset .6cqw 0 0 ${s.accent}">${m}</span>` : `<span>${m}</span>`)).join("")}</div><div class="st" style="background:${s.surface};${clip};border:1px solid ${mix(s.accent, 70)}"><span class="lv">Level <b>24</b></span>${bar("HP", "820 / 1000", 82, "#e5484d")}${bar("Shield", "340 / 500", 68, "#3e9bff")}${bar("XP", "7,450 / 9,000", 83, "#f5b84a")}</div><div class="pr"><span><i>A</i>Select</span><span><i>B</i>Back</span></div></div>`;
  },
  // Visible structure: a bordered nav, the name in system mono, a raw table of the look's own picks.
  raw: (a, _, s) => {
    const ids = [...(a.picks.primitives ?? []), ...(a.picks.motion ?? []), ...(a.picks.icons ?? [])].slice(0, 4);
    return `<div class="q qraw"><div class="nv"><span>Index</span><span>Work</span><span style="background:${s.accent};color:${ink(s.accent)}">Info</span><span>(04)</span></div><b class="h">${esc(a.name.toUpperCase())}</b><div class="tb">${ids
      .map((id, i) => `<span>${String(i + 1).padStart(2, "0")}</span><span>${esc(lib(id)?.name ?? id)}</span><span>${lib(id)?.kind ?? ""}</span>`)
      .join("")}</div></div>`;
  },
  // Symmetry: a stepped double frame and a sunburst fan in fine metal line, tall tracked capitals.
  deco: (a, _, s) => {
    const g = s.accent;
    const rays = Array.from({ length: 19 }, (_, i) => {
      const t = Math.PI + (Math.PI * (i + 0.5)) / 19;
      return `M100 128L${(100 + 74 * Math.cos(t)).toFixed(1)} ${(128 + 62 * Math.sin(t)).toFixed(1)}`;
    }).join("");
    const frame = (o: number) => `M${14 + o} ${6 + o}H${186 - o}V${14 + o}H${194 - o}V${136 - o}H${186 - o}V${144 - o}H${14 + o}V${136 - o}H${6 + o}V${14 + o}H${14 + o}Z`;
    // Top-anchored so the side rules stay under the title in the shorter panel crop.
    return `<div class="q qdeco"><svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMin slice"><g fill="none" stroke="${g}" stroke-width=".7"><path d="${frame(0)}"/><path d="${frame(3.5)}" stroke-opacity=".6"/><path d="${rays}" stroke-opacity=".75"/><path d="M48 128a52 52 0 0 1 104 0M64 128a36 36 0 0 1 72 0"/><path d="M80 128a20 20 0 0 1 40 0" fill="${mix(g, 18)}"/><path d="M100 58l4 6-4 6-4-6z" fill="${g}"/><path d="M40 58H86M114 58H160"/></g></svg><span class="ey">Est. MCMXXV</span><b class="h">${esc(a.name.toUpperCase())}</b><span class="sub">Symmetry · sunburst · one metal</span></div>`;
  },
  // One frozen frame of a title sequence: letters rising out of a line mask, a word sliding in on speed lines, the scrub timeline.
  kinetic: (a, _, s) => {
    const [w1 = "", w2 = ""] = a.name.toUpperCase().split(" ");
    const off = [0, 0, 0, 1, 4, 8, 13, 19, 25];
    const letters = [...w1].map((ch, i) => `<i style="transform:translateY(${off[i] ?? 26}cqw);opacity:${Math.max(0.15, 1 - (off[i] ?? 26) / 24).toFixed(2)}">${esc(ch)}</i>`).join("");
    const c = s.accent;
    return `<div class="q qkin"><span class="cue"><i style="background:${c}"></i>SC 03 · TITLE</span><b class="l1">${letters}</b><span class="spd">${[64, 40, 52].map((w) => `<i style="width:${w}%;background:${c}"></i>`).join("")}</span><b class="l2" style="color:${c}">${esc(w2)}</b><div class="tl"><span>00:02.14</span><span class="tr"><i class="done" style="background:${c}"></i><i class="ph" style="background:${s.text}"></i>${[12, 30, 46, 70].map((x) => `<em style="left:${x}%;background:${x < 46 ? c : "transparent"};border-color:${x < 46 ? c : s.text}"></em>`).join("")}</span><span>scroll</span></div></div>`;
  },
  // The rule's primaries as flat blocks on a black-ruled asymmetric grid; heavy lowercase geometric sans, one line run vertically.
  shapes: (a, _, s) => {
    const p = named(a), r = p.red ?? s.accent, y = p.yellow ?? s.accent, b = p.blue ?? s.text;
    return `<div class="q qsha"><div class="gd"><span class="c c1"><i class="ci" style="background:${r}"></i></span><span class="c c2" style="background:${y}"></span><span class="c c3"><i class="tri" style="background:${b}"></i></span><span class="c c4"><b>${esc(a.name.toLowerCase())}</b><small>${esc(a.summary.split(":")[0]!.toLowerCase())}</small></span><span class="c c5" style="background:${s.text};color:${s.bg}"><em>red · yellow · blue</em></span></div></div>`;
  },
  // One hard diagonal: a red wedge driving into a black circle, thick bars, condensed caps on the slope.
  wedge: (a, _, s) => {
    const r = s.accent, k = s.text;
    return `<div class="q qwed"><svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice"><circle cx="150" cy="50" r="40" fill="${k}"/><path d="M-6 112L22 150L146 54Z" fill="${r}"/><g fill="${k}"><rect x="-10" y="134" width="120" height="7" transform="rotate(-28 50 137)"/><rect x="118" y="104" width="96" height="4" transform="rotate(-28 166 106)"/></g><rect x="160" y="112" width="40" height="40" fill="${r}"/></svg><b class="h">${esc(a.name.toUpperCase())}</b><span class="sl" style="background:${k};color:${s.bg}">Red, black and paper</span></div>`;
  },
  // Cut-paper boomerang, kidney and atomic star in the rule's flat colours, walnut type, a slab accent word.
  atomic: (a, _, s) => {
    const p = named(a), mu = p.mustard ?? s.accent, or = p.orange ?? s.accent, te = p.teal ?? s.accent, wa = p.walnut ?? s.text;
    const atom = (cx: number, cy: number, R: number) =>
      `M${Array.from({ length: 16 }, (_, i) => {
        const rr = i % 2 ? R * 0.16 : i % 4 ? R * 0.6 : R, t = (i * Math.PI) / 8;
        return `${(cx + rr * Math.cos(t)).toFixed(1)} ${(cy + rr * Math.sin(t)).toFixed(1)}`;
      }).join("L")}Z`;
    const [w1, w2] = a.name.split(" ");
    return `<div class="q qato"><svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice"><g transform="translate(22 4)"><path d="M112 22C140 8 192 10 198 34C203 54 182 60 166 50C150 41 138 52 146 72C154 92 134 104 118 92C96 74 88 34 112 22Z" fill="${te}"/><ellipse cx="150" cy="120" rx="34" ry="22" fill="${mu}" transform="rotate(-18 150 120)"/><circle cx="182" cy="96" r="13" fill="${or}"/><path d="${atom(128, 112, 16)}" fill="${wa}"/><g fill="none" stroke="${wa}" stroke-width=".9"><ellipse cx="166" cy="34" rx="16" ry="5" transform="rotate(30 166 34)"/><ellipse cx="166" cy="34" rx="16" ry="5" transform="rotate(-30 166 34)"/></g><circle cx="166" cy="34" r="2.4" fill="${wa}"/></g></svg><b class="h" style="color:${wa}">${esc(w1 ?? "")}</b><b class="acc" style="color:${or}">${esc(w2 ?? "")}</b><div class="chips">${[["mustard", mu], ["orange", or], ["teal", te], ["walnut", wa]].map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("")}</div></div>`;
  },
  // Rules broken on purpose: three disagreeing faces in one line, a tilted panel off the grid, a default blue link, raw pixels.
  broken: (a, _, s) => {
    const px = ["#ff0000", "#00ff00", "#0000ee", "#ffff00", "#000", "#fff"];
    const pix = Array.from({ length: 30 }, (_, i) => `<rect x="${i % 6}" y="${Math.floor(i / 6)}" width="1" height="1" fill="${px[(i * 7 + (i >> 2)) % px.length]}"/>`).join("");
    return `<div class="q qbro"><svg class="px" viewBox="0 0 6 5" shape-rendering="crispEdges">${pix}</svg><div class="pn" style="background:${s.surface};${s.card ?? ""}"><span class="ln1"><em>Anti</em><b>DESIGN</b><code>(on purpose)</code></span><span class="bd">${esc(a.summary.split(":")[0]!)}.</span></div><span class="lnk" style="color:${s.accent}">click here</span><b class="sk">ugly?</b></div>`;
  },
  // Two spot inks overprinting (multiply makes the third colour), misregistered by a hair, halftone, grain, register marks.
  overprint: (a, _, s) => {
    const p = named(a), pk = p.pink ?? s.accent, bl = p.blue ?? s.text, word = esc(a.name.slice(0, 4).toUpperCase());
    const reg = (x: number, y: number) => `<g transform="translate(${x} ${y})"><circle r="3.2"/><path d="M-5 0H5M0-5V5"/></g>`;
    // Every copy draws the same grain, so whichever filter id the browser resolves first is right.
    return `<div class="q qovp"><svg class="gr" viewBox="0 0 200 150" preserveAspectRatio="none"><filter id="riso-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="4"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .16  0 0 0 0 .36  0 0 0 -2.4 1.3"/></filter><rect width="200" height="150" filter="url(#riso-grain)" opacity=".22"/></svg><i class="dot" style="background:radial-gradient(${bl} 38%,transparent 41%) 0 0/2.6cqw 2.6cqw"></i><i class="sun" style="background:${pk}"></i><b class="w" style="color:${bl}">${word}</b><b class="w w2" style="color:${pk}">${word}</b><span class="inks"><i style="background:${pk}"></i>Fluor pink <i style="background:${bl}"></i>Blue</span><svg class="rg" viewBox="0 0 200 150" preserveAspectRatio="none"><g fill="none" stroke="${s.text}" stroke-width=".5">${reg(8, 8)}${reg(192, 8)}</g></svg></div>`;
  },
  // A comic panel: Ben-Day dots, ink outlines with the hard offset shadow, a speech balloon, an action burst.
  comic: (a, _, s) => {
    const p = named(a), cy = p.cyan ?? s.accent, rd = p.red ?? s.accent;
    const spikes = Array.from({ length: 24 }, (_, i) => {
      const r = i % 2 ? 20 : 38, t = (i * Math.PI) / 12 + 0.2;
      return `${(50 + r * Math.cos(t)).toFixed(1)},${(50 + r * Math.sin(t) * 0.8).toFixed(1)}`;
    }).join(" ");
    return `<div class="q qcom"><i class="bd" style="background:radial-gradient(${rd} 30%,transparent 33%) 0 0/3cqw 3cqw"></i><div class="pnl" style="background:radial-gradient(${cy} 26%,transparent 29%) 0 0/2.4cqw 2.4cqw,${s.surface};${s.card ?? ""}"><span class="cap" style="background:${s.bg}">Meanwhile…</span><span class="bal">${esc(a.name.split(" ")[0]!)}!<br><small>Comic-book pop</small></span></div><svg class="burst" viewBox="0 0 100 80"><polygon points="${spikes}" fill="${rd}" stroke="${s.text}" stroke-width="2.4" stroke-linejoin="round"/><text x="50" y="49" text-anchor="middle" font-family="Arial Black,sans-serif" font-weight="900" font-style="italic" font-size="17" fill="${s.bg}" stroke="${s.text}" stroke-width="1.4" paint-order="stroke">POW!</text></svg></div>`;
  },
  // A torn cream scrap on charcoal: noise-eroded display type, erratic tracking, a huge ghost page number, scratches.
  distressed: (a, _, s) => {
    const rust = named(a).rust ?? s.accent, cream = s.surface;
    const word = [...a.name.toUpperCase()].map((c, i) => `<i style="letter-spacing:${[0.02, -0.08, 0.14, -0.04, 0.22, -0.1][i % 6]}em;transform:translateY(${[0, 0.6, -0.4, 0.8, -0.2, 0.3][i % 6]}cqw)">${esc(c)}</i>`).join("");
    return `<div class="q qdis"><svg width="0" height="0"><filter id="erode-${a.id}"><feTurbulence type="fractalNoise" baseFrequency=".32" numOctaves="3" seed="9" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -9 0 0 0 5.1" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="e"/><feTurbulence type="turbulence" baseFrequency=".05" numOctaves="2" seed="2" result="w"/><feDisplacementMap in="e" in2="w" scale="3"/></filter></svg><b class="pg" style="-webkit-text-stroke-color:${mix(cream, 38)}">27</b><div class="scrap" style="background:radial-gradient(circle at 78% 70%,transparent 9cqw,${mix("#7a5a2a", 22)} 9.3cqw,transparent 10.6cqw),radial-gradient(ellipse at 20% 30%,${mix("#7a5a2a", 14)},transparent 40%),${cream}"><i class="tape" style="background:${mix(rust, 75)}"></i><b class="h" style="filter:url(#erode-${a.id})">${word}</b><span class="sub">Distressed, eroded, off-kilter</span><span class="body">${esc(a.summary.split(":")[1]?.trim().split(",")[0] ?? "")}.</span></div><i class="scr"></i></div>`;
  },
  // Photocopied cut-and-paste: ransom letters each on a scrap, typewriter text, coarse halftone, tape, a stamp and a marker stroke.
  xerox: (a, _, s) => {
    const sc: [string, string][] = [
      ["background:#121212;color:#fff;font-family:Georgia,serif;font-weight:700", "-6"],
      ["background:#fff;color:#121212;box-shadow:inset 0 0 0 .5cqw #121212;font-family:var(--font-mono)", "4"],
      [`background:${s.accent};color:#fff;font-family:'Arial Black',sans-serif`, "-3"],
      ["background:#d8d4c8;color:#121212;font-family:'Times New Roman',serif;font-style:italic", "7"],
    ];
    const letters = [..."ZINE"].map((c, i) => `<span style="${sc[i]![0]};transform:rotate(${sc[i]![1]}deg)">${c}</span>`).join("");
    return `<div class="q qxer"><i class="ht"></i><div class="rn">${letters}</div><p class="tw">ISSUE #3 ..... $1<br>${esc(a.summary.split(":")[1]?.trim() ?? a.summary)}</p><i class="tape"></i><span class="stamp" style="color:${s.accent};border-color:${s.accent}">DIY</span><svg class="mk" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M2 6C20 2 40 9 60 4S90 5 98 3" stroke="${s.accent}" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg></div>`;
  },
  // A block-editor page: quiet sidebar, title, inline properties, a block with its drag handle and the open slash menu.
  page: (a, _, s) => {
    const doc = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3h7l4 4v14H7zM14 3v4h4"/></svg>`;
    return `<div class="q qpag"><div class="sb" style="background:${s.surface}"><span class="acct"><i>A</i>Acme</span>${["Getting started", "Editor picks", "Meeting notes", "Roadmap"].map((t, i) => `<span class="it${i === 1 ? " on" : ""}">${doc}${t}</span>`).join("")}</div><div class="pg"><b class="t">Editor picks</b><div class="pr"><span>Status</span><em style="background:${mix(s.accent, 14)};color:${s.accent}">In progress</em></div><div class="pr"><span>Tags</span>${(a.picks.editor ?? []).map((id) => `<em>${esc(lib(id)?.name ?? id)}</em>`).join("")}</div><span class="bl"><i>⋮⋮</i><i>+</i><span>/ta<i class="cur" style="background:${s.text}"></i></span></span><div class="sl"><span class="sh">Basic blocks</span><span class="on"><i>▦</i>Table</span><span><i>☐</i>To-do list</span><span><i>▸</i>Toggle list</span></div></div></div>`;
  },
  // A public-service question page: dark header on the link-blue rule, Back, one big question, the yellow focus ring, green Continue.
  service: (a, _, s) => {
    const p = named(a), green = p.green ?? s.accent, yellow = p.yellow ?? s.accent;
    return `<div class="q qsvc"><div class="hd" style="background:${s.text};border-color:${s.accent}"><b>Apply for a permit</b><span>Sign out</span></div><div class="bd"><span class="bk" style="color:${s.text}">‹ Back</span><span class="cap">Step 2 of 4</span><b class="qn">What is your postcode?</b><span class="hnt">For example, SW1A 2AA</span><span class="in" style="box-shadow:inset 0 0 0 .6cqw ${s.text},0 0 0 1cqw ${yellow}">SW1A<i class="cur" style="background:${s.text}"></i></span><span class="go" style="background:${green};box-shadow:0 .6cqw 0 ${mix(green, 50, "#000")}">Continue</span></div></div>`;
  },
  // Nav, content and code: ⌘K search and a version switcher, an active nav item, an anchored heading, an install block, a note.
  reference: (a, _, s) => {
    const kit = a.picks.primitives?.[0] ?? "base-ui";
    return `<div class="q qref"><div class="tp"><b><i style="background:${s.accent}"></i>Docs</b><span class="srch">Search docs<kbd>⌘K</kbd></span><span class="ver">v4.2 ▾</span></div><div class="nv" style="background:${s.surface}"><span class="gh">Guides</span><span>Introduction</span><span class="on" style="color:${s.accent};box-shadow:inset .5cqw 0 0 ${s.accent};background:${mix(s.accent, 8)}">Installation</span><span>Theming</span><span class="gh">API reference</span><span class="mono">pick()</span><span class="mono">plan()</span></div><div class="main"><span class="crumb">Getting started</span><b class="t">Installation<em style="color:${s.accent}">#</em></b><p>Install ${esc(lib(kit)?.name ?? kit)}, then import the parts you need.</p><div class="cb"><div class="tabz"><span class="on">npm</span><span>pnpm</span><span>yarn</span><em>Copy</em></div><code><b style="color:${mix(s.accent, 55, "#fff")}">$</b> ${esc(lib(kit)?.install ?? `npm i ${kit}`)}</code></div><div class="note" style="border-color:${s.accent};background:${mix(s.accent, 7)}"><b style="color:${s.accent}">Note</b> Requires React 19.</div></div></div>`;
  },
  // A homemade homepage: starry tiled ground, a solid column in the swatch's ridge border, a rainbow rule, link and visited-purple
  // underlines, a hit counter and 88x31 buttons.
  homepage: (a, _, s) =>
    `<div class="q qhom"><div class="page" style="background:${s.surface};${s.card ?? ""}"><b class="h">Welcome to my ${esc(a.name)} Homepage!</b><i class="rb"></i><span class="uc">Under construction</span><span class="ln"><u style="color:${s.accent}">Cool Links</u> | <u style="color:#551a8b">Sign my Guestbook</u> | <u style="color:${s.accent}">Webring</u></span><span class="hits">You are visitor <b>${[0, 0, 4, 2, 1, 7].map((d) => `<i>${d}</i>`).join("")}</b></span><span class="bt"><i>HTML 3.2</i><i class="b2">800x600</i><i class="b3">Notepad</i></span></div></div>`,
};
/** A look's specimen: the `.spec` box's class, style and inner HTML (a look without a layout gets the plainest one). */
export const specimen = (a: Aesthetic) => ({ cls: `spec f-${a.swatch.font}`, style: `background:${a.swatch.bg};color:${a.swatch.text}`, html: layouts[a.swatch.layout ?? "quiet"](a, parts(a.swatch), a.swatch) });
