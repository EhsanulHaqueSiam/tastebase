// Selection engine: pure functions over the registry. The MCP server formats what these return.
// Everything is deterministic keyword scoring; the calling agent makes the final judgment from the reasons.

import type { Aesthetic, AestheticId, Framework, Kind, Library } from "./registry/schema.ts";

const STOP = new Set("a an and the for of to in on with my me i we our app ui page that this is it be like need want some use make build".split(" "));
// Words that mean the same job. Keys and values are stems (see `stem`).
const SYN: Record<string, string[]> = {
  notification: ["toast"], snackbar: ["toast"], alert: ["toast"],
  modal: ["dialog"], popup: ["dialog", "popover"], sheet: ["drawer"], bottomsheet: ["drawer"],
  counter: ["number"], price: ["number"], stat: ["number"], ticker: ["number"],
  palette: ["command"], spotlight: ["command"], cmdk: ["command"],
  glassmorphism: ["glass"], frost: ["glass"], translucent: ["glass"],
  graph: ["chart"], plot: ["chart"], analytic: ["chart", "dashboard"],
  gradient: ["background", "shader"], shader: ["background"], hero: ["background", "landing"],
  carousel: ["slider", "swipe"], swipe: ["gesture"], drag: ["gesture", "dnd"],
  chat: ["agent", "message"], llm: ["agent", "chat"], ai: ["agent"], stream: ["agent"],
  animation: ["motion", "animate"], animate: ["motion"], transition: ["motion"],
  morph: ["text", "transition"], icon: ["icon"], webgl: ["3d"], three: ["3d"],
};

export function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

export function terms(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/bottom sheet/g, "bottomsheet").split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue;
    const s = stem(raw);
    out.add(s);
    for (const x of SYN[s] ?? []) out.add(x);
  }
  return out;
}

const overlap = (q: Set<string>, text: string) => {
  let n = 0;
  for (const t of terms(text)) if (q.has(t)) n++;
  return n;
};

// Brief words -> the kinds of library an app needs. Order is the order needs are reported in.
const NEEDS: [Kind, RegExp][] = [
  ["motion", /anim|motion|transition|spring|micro.?interaction|delight|smooth|fluid/],
  ["text-effects", /morph|text effect|scramble|typewriter|counter|number|price|stat|ticker|copy button/],
  ["interaction", /drawer|sheet|carousel|slider|swipe|gesture|drag|sortable|reorder|kanban/],
  ["feedback", /toast|notification|snackbar|alert|progress|skeleton|loading|confetti|celebrat/],
  ["command", /command|⌘k|cmd.?k|palette|spotlight|quick search/],
  ["glass", /glass|translucent|frosted|refract|visionos/],
  ["background", /background|gradient|shader|hero|landing|aurora|grain|noise|dither|particle/],
  ["3d", /3d|webgl|three|scene|model viewer|spline/],
  ["charts", /chart|graph|dashboard|analytic|metric|plot|visuali/],
  ["agent-ui", /chat|agent|llm|ai assistant|copilot|stream|prompt/],
  ["scroll", /scroll|parallax|longform|storytelling|scrollytell/],
  ["icons", /./], // every UI needs icons
];

const MATURITY = { established: 1, stable: 0.6, experimental: 0 } as const;

export type Scored = { lib: Library; score: number; why: string; caution?: string };

/** Best libraries for one purpose ("copy button feedback", "hero background"). */
export function pick(
  libs: Library[],
  need: string,
  opts: { framework?: Framework; look?: Aesthetic; kind?: Kind; limit?: number } = {},
): Scored[] {
  const q = terms(need);
  const kindHits = new Set(NEEDS.filter(([k, re]) => k !== "icons" && re.test(need.toLowerCase())).map(([k]) => k));
  if (/icon/.test(need.toLowerCase())) kindHits.add("icons");
  const out: Scored[] = [];
  for (const lib of libs) {
    if (opts.framework && !lib.frameworks.includes(opts.framework)) continue;
    const libKinds = [lib.kind, ...(lib.alsoCovers ?? [])];
    if (opts.kind && !libKinds.includes(opts.kind)) continue;
    let best = "", bestN = 0, score = 0;
    for (const u of lib.useFor) {
      const n = overlap(q, u);
      score += n * 3;
      if (n > bestN) [best, bestN] = [u, n];
    }
    score += overlap(q, `${lib.id} ${lib.name} ${lib.tagline}`) * 2 + overlap(q, lib.note) * 0.5;
    // A library built for the job beats a kit that also covers it.
    if (kindHits.has(lib.kind)) score += 4;
    else if (lib.alsoCovers?.some((k) => kindHits.has(k))) score += 1.5;
    if (opts.look) score += lookBonus(lib, opts.look);
    let caution: string | undefined;
    for (const a of lib.avoidWhen) if (overlap(q, a) >= 2) { score -= 3; caution = a; break; }
    if (score <= 0) continue;
    score += Math.min(1.5, (lib.stats?.starsWeek ?? 0) / 400); // momentum breaks ties, never overrides fit
    out.push({ lib, score: score + MATURITY[lib.maturity], why: best || lib.tagline, caution });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 3);
}

function lookBonus(lib: Library, look: Aesthetic): number {
  let b = 0;
  const i = lib.aesthetic.indexOf(look.id);
  if (i >= 0) b += 2 - i * 0.4;
  for (const ids of Object.values(look.picks)) {
    const r = ids?.indexOf(lib.id) ?? -1;
    if (r >= 0) b = Math.max(b, 8 - 2 * r); // the look's own picks should usually win
  }
  return b;
}

const isEffectsKit = (l: Library) => l.kind === "component-kit" && !!l.alsoCovers?.some((k) => k === "motion" || k === "background" || k === "text-effects");

/** Which looks a brief asks for, strongest first. Phrase signals beat single words. */
export function detectLooks(looks: Aesthetic[], brief: string): Aesthetic[] {
  const text = ` ${brief.toLowerCase()} `;
  return looks
    .map((a) => ({ a, s: a.signals.reduce((n, sig) => n + (text.includes(sig) ? sig.split(" ").length : 0), 0) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .map((x) => x.a);
}

export type PlanItem = { kind: Kind; pick?: Scored; alternatives: Scored[] };
export type Plan = { look: Aesthetic; lookGuessed: boolean; also: Aesthetic[]; items: PlanItem[]; framework: Framework; frameworkGuessed: boolean };

const FRAMEWORK_WORDS: [Framework, RegExp][] = [
  ["react-native", /react native|expo\b/],
  ["vue", /\bvue\b|nuxt/],
  ["svelte", /svelte/],
  ["solid", /solid\s?js|\bsolid\b/],
  ["angular", /angular/],
  ["vanilla", /vanilla|no framework|plain html/],
  ["react", /react|next\.?js|remix|tanstack|vite/],
];

/** Framework named in a brief, if any. */
export const detectFramework = (brief: string) => FRAMEWORK_WORDS.find(([, re]) => re.test(brief.toLowerCase()))?.[0];

/** One pick per need for a whole app brief, tuned to the detected look. */
export function plan(libs: Library[], looks: Aesthetic[], brief: string, opts: { framework?: Framework; look?: AestheticId } = {}): Plan {
  const found = opts.look ? looks.filter((a) => a.id === opts.look) : detectLooks(looks, brief);
  const fallback = looks.find((a) => a.id === "minimal") ?? looks[0];
  if (!fallback) throw new Error("registry has no aesthetics");
  const look = found[0] ?? fallback;
  const lower = brief.toLowerCase();
  // Kits impose their own look; raw looks build on unstyled primitives instead.
  const base: Kind = ["brutalist", "editorial", "luxury", "retro"].includes(look.id) ? "primitives" : "component-kit";
  const needs: Kind[] = [base, ...NEEDS.filter(([, re]) => re.test(lower)).map(([k]) => k)];
  for (const k of Object.keys(look.picks) as Kind[]) if (["motion", "background", "glass"].includes(k) && !needs.includes(k)) needs.push(k);
  const named = opts.framework ?? detectFramework(brief);
  const framework = named ?? "react";
  const items = [...new Set(needs)].map((kind): PlanItem => {
    let ranked = pick(libs, `${brief} ${kind}`, { framework, look, kind, limit: 8 });
    // The base layer must be a foundation kit, not an effects kit (those surface under motion/background instead).
    if (kind === base) ranked = ranked.filter((s) => !isEffectsKit(s.lib));
    // Libraries built for this kind lead; kits that merely also cover it stay as alternatives.
    ranked.sort((x, y) => Number(y.lib.kind === kind) - Number(x.lib.kind === kind));
    return { kind, pick: ranked[0], alternatives: ranked.slice(1, 3) };
  });
  return { look, lookGuessed: !found.length, also: found.slice(1, 3), items, framework, frameworkGuessed: !named };
}
