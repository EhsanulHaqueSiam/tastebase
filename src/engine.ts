// Selection engine: pure functions over the registry. The MCP server formats what these return.
// Everything is deterministic keyword scoring; the calling agent makes the final judgment from the reasons.

import { paywalled } from "./atlas.ts";
import { siteTypes } from "./registry/index.ts";
import type { Aesthetic, AestheticId, Framework, Kind, Library, SiteType } from "./registry/schema.ts";

// Framework names are stop words: the framework filter handles them, and "React" in a use case is not a job. So are
// the words that name a look ("in the Aurora look"): a look is not a job either.
const STOP = new Set(
  "a an and the for of to in on with my me i we our app ui page that this is it be like need want some use make build look style styled aesthetic vibe feel inspired react native vue svelte solid angular expo vanilla js".split(" "),
);
// Words that mean the same job. Keys and values are stems (see `stem`).
const SYN: Record<string, string[]> = {
  notification: ["toast"], snackbar: ["toast"], alert: ["toast"],
  modal: ["dialog"], popup: ["dialog", "popover"], sheet: ["drawer"], bottomsheet: ["drawer"],
  counter: ["number"], price: ["number"], stat: ["number"], ticker: ["number"], balance: ["number"], balanc: ["number"], pric: ["number"], // "balancing", "pricing"
  palette: ["command"], spotlight: ["command"], cmdk: ["command"],
  glassmorphism: ["glass"], frost: ["glass"], translucent: ["glass"],
  graph: ["chart"], plot: ["chart"], analytic: ["chart", "dashboard"],
  gradient: ["background", "shader"], shader: ["background"], hero: ["background", "landing"],
  carousel: ["slider", "swipe"], swipe: ["gesture"], drag: ["gesture", "dnd"],
  chat: ["agent", "message"], llm: ["agent", "chat"], ai: ["agent"], typ: ["typewriter"],
  resiz: ["resizable"], animation: ["motion", "animate"], animate: ["motion"], transition: ["motion"],
  morph: ["text", "transition"], icon: ["icon"], webgl: ["3d"], three: ["3d"],
};

// Plurals fold onto the singular ("files" = "file", "heroes" = "hero", "glasses" = "glass", "stories" = "story"); "glass" keeps its s.
export function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(s|x|z|ch|sh|o)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

// Stemmed content words. Compounds that name one thing stay one word: a progress bar is a kit part, not progress in
// general (an upload toast).
const stems = (text: string) =>
  text.toLowerCase().replace(/bottom sheet/g, "bottomsheet").replace(/progress bar/g, "progressbar").split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map(stem);

const expand = (ws: Iterable<string>) => {
  const out = new Set<string>();
  for (const s of ws) {
    out.add(s);
    for (const x of SYN[s] ?? []) out.add(x);
  }
  return out;
};
/** A text's words and their synonyms, for scoring. */
export const terms = (text: string) => expand(stems(text));

/** A job's words, each with its synonyms, and the terms it scores with. */
type Job = { ws: string[][]; all: Set<string> };
const wordsOf = (text: string) => [...new Map(stems(text).map((s) => [s, [s, ...(SYN[s] ?? [])]])).values()];
const jobOf = (text: string): Job => ({ ws: wordsOf(text), all: terms(text) });

/** Stemmed words padded with spaces: `words(a).includes(words(b))` is a whole-word phrase match ("dev-tool" = "dev tool"). */
export const words = (s: string) => ` ${s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem).join(" ")} `;

// Registry text is fixed for the life of the Worker, so parse each string once (keeps a plan well under 10ms CPU):
// its words, and with their synonyms.
const parsed = new Map<string, { raw: string[]; all: Set<string> }>();
const parse = (text: string) => {
  let p = parsed.get(text);
  if (!p) {
    const raw = stems(text);
    parsed.set(text, (p = { raw, all: expand(raw) }));
  }
  return p;
};
const overlap = (q: Set<string>, text: string) => {
  let n = 0;
  for (const w of parse(text).all) if (q.has(w)) n++;
  return n;
};
// How many of a job's words a text names, for fit and avoid decisions (scores use `overlap`). A word counts once
// however many synonyms match, and so does a text word two job words share ("number counter" vs "a number"). A job
// word matches a text that says it, a synonym of it, or a word it is a synonym of; never through two hops ("hero" ->
// background <- "gradient").
const matched = ({ ws, all }: Job, text: string, shared = overlap(all, text)) => {
  if (!shared) return 0;
  const { all: t, raw } = parse(text);
  let n = 0;
  for (const [w, ...syn] of ws) if (t.has(w!) || syn.some((a) => raw.includes(a))) n++;
  return Math.min(n, shared);
};
// The situation each avoid line describes: the text before its colon, not the alternative it names.
const situations = new WeakMap<Library, string[]>();
// Negated words describe what the situation lacks ("no Tailwind in the stack"), so a brief that says Tailwind is no match.
const situationsOf = (l: Library) => situations.get(l) ?? situations.set(l, l.avoidWhen.map((a) => negations(a.split(":")[0]!).want)).get(l)!;
/** How closely a library's own avoidWhen describes the job (counted from `least` words), and the line that does when
 * it shares 2+ words. */
function avoidance(l: Library, job: Job, least = 2) {
  let n = 0, i = -1;
  situationsOf(l).forEach((sit, j) => {
    const t = overlap(job.all, sit);
    const m = t >= least && t > n ? matched(job, sit, t) : 0; // never above its term overlap
    if (m > n) [n, i] = [m, j];
  });
  return { n, line: n >= 2 ? l.avoidWhen[i] : undefined };
}

// "no shaders", "without animations or gradients": the words after a negation, up to the next clause.
const NEGATED = /\b(no(?!-)|without|avoid|never|skip|not|rather than|instead of|don'?t (?:want|use|need))\b([^.,;:!?()]*?)(?=[.,;:!?()]|\b(?:but|with|just|only)\b|$)/g;

/** What a brief asks for (`want`) and what it rules out (`not`), both lowercased. */
export function negations(brief: string): { want: string; not: string } {
  const not: string[] = [];
  // "a plain blue background" is a CSS colour, not a background library.
  let want = brief.toLowerCase().replace(/\b(?:plain|solid|flat)\s+(?:[a-z]+\s+){0,2}background\b/g, " colour fill ")
    .replace(/\bone[- ]time (?:password|passcode|code)\b|\b(?:2fa|verification|sms) code\b/g, "otp"); // what kits call it
  // Until nothing changes: the rest of "no motion and no gradients" comes back with its own "no" to read.
  for (let prev = ""; prev !== want; ) {
    prev = want;
    want = want.replace(NEGATED, (_, cue: string, span: string) => {
      // "no animation and charts" rules out animation only; "without animations and gradients" rules out both.
      const [neg = "", rest = ""] = /^(no|not|never)$/.test(cue) ? span.split(/\band\b(.*)/s) : [span];
      not.push(neg);
      return ` ${rest} `;
    });
  }
  return { want, not: not.join(", ") };
}

// Brief words -> the kinds of library an app needs. Order is the order needs are reported in.
const NEEDS: [Kind, RegExp][] = [
  ["motion", /\b(animat|motion|transition|spring|micro.?interaction|delight)/], // not "smooth": a smooth checkout is frictionless, not animated
  ["text-effects", /\b(morph|text effect|scramble|typewriter|typing|counters?\b|(?<!phone )numbers?\b|prices?\b|stats?\b|balances?\b|ticker|copy button)/],
  ["interaction", /\b(drawer|sheet|bottom.?sheet|carousel|slider|swipe|gesture|drag|sortable|reorder|kanban)/],
  ["feedback", /\b(toast|notification|snackbar|alert|skeleton|loading|loader|spinner|confetti|celebrat)/], // not "progress": a progress bar is a kit part
  ["command", /\b(command|cmd.?k|spotlight|quick search|search palette)|⌘k/],
  ["glass", /\b(glass(?!es)|translucent|frosted|refract|visionos)/],
  ["background", /\b((?<!solid |solid colou?r |plain |white |black )background|gradient|shader|aurora|grain|noise|dither|particle)/], // a solid colour background is CSS
  ["3d", /\b(3d|webgl|three\.?js|r3f|scene|model viewer|spline)/],
  ["charts", /\b(charts?\b|(?<!(?:node|knowledge|dependency|social|scene) )graphs?\b(?! editor)|dashboard|analytic|metric|plot|visuali|data journalism|data stor|spending by|sparkline)/], // not "breakdown" or "by category": a plan breakdown or a category filter is no chart
  ["agent-ui", /\b(chat|agent|llm|ai assistant|copilot|prompt)/], // not "stream": a video stream is no chat
  ["scroll", /\b((?<!infinite |virtual |virtualized )scroll(?!bar| area)|parallax|longform|storytelling|scrollytell)/],
  ["tables", /\b(data ?tables?|data ?grids?|spreadsheet|sortable columns|(?<!pricing |periodic |coffee |dining |kitchen |book a |reserve a )tables?\b(?! of contents| tennis| booking| reservation))/],
  ["editor", /\b(rich.?text|wysiwyg|(?:text|markdown|block|document|docs?|code|source|python|sql|json|notion.?(?:like|style)) editor|(?<!(?:video|photo|image|audio|music|level|map|pdf) )editor app|notes? app|note.?taking|flowchart|node.?based|workflow (?:builder|editor|canvas)|diagram editor|node (?:graph|editor)|nodes\b[^.,;]{0,30}\bedges|(?:connect|link) (?:the )?(?:workflow )?(?:nodes|blocks)|graph editor|mind ?map)/],
  ["icons", /\bicons?\b/],
];
// The same patterns run to the end of the word, to quote what asked for a kind ("confetti", "bottom sheet").
const QUOTE = new Map(NEEDS.map(([k, re]) => [k, new RegExp(`(?:${re.source})[a-z]*`, "g")]));
const quote = (text: string, kind: Kind) => text.match(QUOTE.get(kind)!)?.join(" ") ?? "";
const KIT = /\b(ui (library|kit)|component.?(library|kit)|design system)\b/;
const kindsIn = (text: string) => new Set(NEEDS.filter(([, re]) => re.test(text)).map(([k]) => k));
/**
 * The job's object: the last kind named in its opening phrase, before "of", "with", "showing"... ("tiny sparkline
 * showing the bitcoin price" is a chart; "animated typing headline" a text effect; "price that rolls" a number).
 */
const leadKind = (text: string) => {
  const head = text.split(/\b(?:of|for|with|showing|shows|that|which|in|on|to|from|by|where|when|and)\b|[,.;:]/)[0] ?? "";
  const at = (t: string) => NEEDS.map(([k, re]) => [k, Math.max(...[...t.matchAll(new RegExp(re.source, "g"))].map((m) => m.index), -1)] as const).filter(([, i]) => i >= 0);
  const found = [...(at(head).length ? at(head) : at(text))].sort((a, b) => b[1] - a[1]);
  // "Animated" or "animation" only says how; another kind named with it is the thing ("a typing animation").
  return (found.find(([k]) => k !== "motion") ?? found[0])?.[0];
};

const MATURITY = { established: 1, stable: 0.6, experimental: 0 } as const;

// shadcn registry items (`npx shadcn add ...`) install into a shadcn/ui project; under another kit they drag in a second setup.
const viaShadcn = (l: Library) => l.install.includes("shadcn@");
const pairs = (a: Library, b: Library) => !!(a.pairsWith?.includes(b.id) || b.pairsWith?.includes(a.id));
/** True when `lib` belongs to a different kit's ecosystem than the app's base kit. */
// Off the base kit: a shadcn registry install under another kit, or a library whose own avoidWhen names the base
// ("a shadcn/ui project already on Lucide": Phosphor is not the icon set under shadcn/ui).
const shunsBase = (lib: Library, base: Library) => situationsOf(lib).some((sit) => { const w = words(sit); return w.includes(words(base.name)) || w.includes(words(base.id)); });
export const offKit = (lib: Library, base: Library) => (viaShadcn(lib) && base.id !== "shadcn-ui" && !viaShadcn(base)) || shunsBase(lib, base);
const isFoundation = (k: Kind | undefined) => k === "component-kit" || k === "primitives";
const isEffectsKit = (l: Library) => l.kind === "component-kit" && !!l.alsoCovers?.some((k) => k === "motion" || k === "background" || k === "text-effects");
// A kit installed whole (Mantine, MUI) is an app's base, never the answer to one job: the project's own kit has that part.
const wholeKit = (l: Library) => l.kind === "component-kit" && !viaShadcn(l) && !isEffectsKit(l) && !l.themed;
// Whether a tagline names one of the words: whole stems, or a long stem's longer form ("animat" -> "animation").
const names = (said: string[], text: string) => {
  for (const t of parse(text).all) for (const w of said) if (t === w || (w.length >= 5 && t.startsWith(w))) return true;
  return false;
};
// Whether a library names what was asked: in its tagline or a use case, and for a kit that ships it, a part.
const namesIn = (said: string[], l: Library, parts = false) =>
  names(said, l.tagline) || l.useFor.some((u) => names(said, u)) || (parts && !!l.parts && names(said, l.parts.free.join(" ")));
// A library's id and name as `words`, built once.
const ids = new WeakMap<Library, { name: string; id: string }>();
const idsOf = (l: Library) => {
  let t = ids.get(l);
  if (!t) ids.set(l, (t = { name: words(l.name), id: words(l.id) }));
  return t;
};

export type Scored = { lib: Library; score: number; why: string; caution?: string };

/** A brief without the look's id, name and signals. */
const lookless = (text: string, look?: Aesthetic) => (look ? [look.id, look.name.toLowerCase(), ...look.signals].reduce((t, sig) => t.replaceAll(sig, " "), text) : text);

/**
 * Best libraries for one purpose ("copy button feedback", "hero background"), or for one `kind` slot of a plan.
 * Only real fits come back, so the list is empty when nothing fits.
 */
export function pick(
  libs: Library[],
  need: string,
  opts: { framework?: Framework; look?: Aesthetic; kind?: Kind; limit?: number; base?: Library } = {},
): Scored[] {
  const { want, not } = negations(need);
  const own = terms(want);
  const no = terms(not);
  // The words themselves, without synonyms: "no shaders" rules out shadergradient, not every background library.
  // "no shaders" also rules out what shaders run on (WebGL, three.js), not only libraries that say shader.
  const noWords = [...new Set(words(not).split(" ").filter((w) => w.length > 3 && !STOP.has(w)).flatMap((w) => [w, ...(NO_ALSO[w] ?? [])]))];
  const hits = kindsIn(want);
  const lead = leadKind(want);
  if (KIT.test(want)) hits.add("component-kit");
  const { look, kind: slot } = opts;
  const foundation = isFoundation(slot);
  // A slot's own word ("chart") ranks inside it; "component kit" says nothing every kit does not. Words that asked for
  // another slot are no reason here: "a data table and toasts" does not make a skeleton loader fit the toasts.
  const elsewhere = slot && !foundation ? terms(NEEDS.filter(([k]) => k !== slot).map(([k]) => quote(want, k)).join(" ")) : undefined;
  const q = elsewhere ? new Set([...[...own].filter((t) => !elsewhere.has(t)), ...terms(`${slot} ${quote(want, slot!)}`)]) : own;
  const ownW = jobOf(want);
  const qW: Job = elsewhere ? { ws: [...new Map([...ownW.ws.filter((w) => !elsewhere.has(w[0]!)), ...wordsOf(`${slot} ${quote(want, slot!)}`)].map((w) => [w[0], w])).values()], all: q } : ownW;
  // A kind the look added (springs for apple) is filled by its picks only: brief words that happen to match are not a reason.
  const unasked = slot && !foundation && !hits.has(slot);
  if (slot) hits.add(slot);
  const family = look && (look.family ?? look.id);
  // The look's own words name the look, not a library: "liquid glass music player" is not the liquid-glass library.
  const task = lookless(want, look);
  const said = words(task);
  // An explicit empty list is the look's decision to use no library for the kind (glassmorphism's glass is CSS).
  // It holds unless the brief asks for the kind outside the look's own words ("like linear ... with a shader hero").
  const none = !!slot && look?.picks[slot]?.length === 0 && !kindsIn(look.signals.reduce((t, sig) => t.replaceAll(sig, " "), want)).has(slot);
  const usable = opts.framework ? new Set(libs.filter((l) => l.frameworks.includes(opts.framework!)).map((l) => l.id)) : undefined;
  const out: (Scored & { home: boolean; fit: number; picked: boolean })[] = [];
  // The fit of the closest library its own avoidWhen ruled out: the job is that situation, so anything that fits it less
  // goes too ("drag and drop file upload": not dnd-kit, so not vaul either), and when it does the job's own kind, so
  // does anything that fits only as well ("gantt chart": recharts says no, and no chart library names gantt). A base
  // layer is chosen on other grounds.
  let ruled = 0;
  let peer = false;
  const spared = new Set<string>(); // what the ruling avoid lines send the job to ("...: use recharts")
  for (const lib of libs) {
    if (opts.framework && !lib.frameworks.includes(opts.framework)) continue;
    // A base layer is a foundation kit: not a library that also ships a few components (glisse, agent-ui sets), nor an
    // effects kit (Aceternity), which surfaces under motion or background instead.
    if (slot && (foundation ? lib.kind !== slot || isEffectsKit(lib) : lib.kind !== slot && !lib.alsoCovers?.includes(slot))) continue;
    const named = said.includes(idsOf(lib).name) || said.includes(idsOf(lib).id);
    if (none && !named) continue;
    // One job is a part of the project's kit, not a reason to adopt a second whole kit (a date picker is not MUI).
    if (!foundation && !named && wholeKit(lib) && lib !== opts.base && !hits.has("component-kit")) continue;
    const picked = !!look && [...(slot ? [slot] : hits)].some((k) => look.picks[k]?.includes(lib.id));
    let best = "", bestN = 0, sum = 0, bestW = 0;
    for (const u of lib.useFor) {
      const n = overlap(q, u);
      sum += n;
      if (n > bestN) [best, bestN] = [u, n];
      if (n > bestW) bestW = Math.max(bestW, matched(qW, u, n)); // never above n, q's term overlap
    }
    const fit = Math.max(bestW, matched(qW, lib.tagline)); // job words its best use case or tagline names
    const kindFit = hits.has(lib.kind) ? (hits.size > 1 ? (lib.kind === (slot ?? lead) ? 6 : -1) : 4) : lib.alsoCovers?.some((k) => hits.has(k)) ? 1.5 : 0;
    // A real fit: named, the look's pick, or the job's words in a use case or the tagline of a library of its kind.
    // Kits that are a look (98.css, NES.css) come only with that look, or for a job that describes them closely.
    if (!named && !picked) {
      // With a look, only that look's picks (Windows XP gets xp-css, never 7.css); without one, a job that describes the
      // kit in its own words ("windows 95 settings dialog"), not the slot's ("component kit"), and names its theme: the
      // tagline before the colon. "Progress bar" is not NES.css, whose tagline lists progress bars after it.
      if (lib.themed && (look || !matched(ownW, lib.tagline.split(":")[0]!) || Math.max(matched(ownW, lib.tagline), ...lib.useFor.map((u) => matched(ownW, u))) < 2)) continue;
      if (!foundation && (unasked || (hits.size ? !kindFit || fit < 1 : fit < 2))) continue;
    }
    // A kind the look added ranks in the look's own order; words in the brief are about other things.
    let score = unasked ? 0 : bestN * 3 + (sum - bestN) + kindFit + overlap(q, `${lib.id} ${lib.name} ${lib.tagline}`) * 2 + overlap(q, lib.note) * 0.5;
    if (look) score += lookBonus(lib, look, usable);
    if (opts.base && opts.base !== lib) score += offKit(lib, opts.base) ? -6 : pairs(lib, opts.base) ? 2 : 0;
    // The situation before the colon counts, not the alternative it names. Closer than the library's best use case:
    // not this library ("Python code editor" is not tiptap), nor anything that fits the job less; as close: a warning.
    const { n: avoid, line } = named ? { n: 0, line: undefined } : avoidance(lib, ownW);
    // A base kit whose avoid line sends the job to an effects kit stays the base, with the warning: effects kits sit on
    // top of one (shadcn/ui: "start from magic-ui ..., keep shadcn for forms").
    const ontop = foundation && !!line && libs.some((l) => isEffectsKit(l) && line.includes(l.id));
    // The look's own pick for its slot yields only to a close match, not two stray words ("one big button" is not
    // number-flow's "big one-off stat").
    const kept = !!slot && picked && avoid < 3;
    if (line && avoid > bestW && !ontop && !kept) {
      if (!foundation && fit >= ruled) {
        if (fit > ruled) {
          peer = false;
          spared.clear();
        }
        ruled = fit;
        peer ||= hits.has(lib.kind);
        const remedy = line.slice(line.indexOf(":"));
        for (const l of libs) if (remedy.includes(l.id)) spared.add(l.id);
      }
      continue;
    }
    // A still look (minimal, corporate, civic: "nothing moves unless the user did something") warns about motion it did
    // not pick: an on-load text effect or ambient shader breaks its own rule.
    const restless = !!look && !picked && !named && [lib.kind, ...(lib.alsoCovers ?? [])].some((k) => MOVING.includes(k)) && STILL.test(look.motion);
    const caution = line && avoid >= bestW ? line : restless ? `${look!.name} keeps still: ${look!.motion.match(STILL)![0]}` : undefined;
    if (caution) score -= restless ? 8 : 3;
    // "no shaders": not paper-shaders or shadergradient (inside an id), nor a tagline that says shader.
    if (!named && noWords.some((w) => `${lib.id} ${lib.name}`.toLowerCase().includes(w) || words(`${lib.tagline} ${best}`).includes(` ${w} `))) continue;
    if (no.size && overlap(no, `${best} ${lib.tagline}`)) score -= 3; // "no animation and charts": not the animated charts
    if (score <= 0 && !named) continue;
    score += Math.min(1.5, (lib.stats?.starsWeek ?? 0) / 400); // momentum breaks ties, never overrides fit
    const home = named || picked || !family || lib.aesthetic.includes(family as AestheticId);
    const why = named ? "named in the brief" : (!unasked && best) || (picked ? "look's pick" : lib.tagline);
    out.push({ lib, score: score + MATURITY[lib.maturity], why, caution, home, fit, picked });
  }
  // What asked for each kind ("typewriter", "confetti", "bottom sheet"), not counting the look's own words ("aurora").
  const asks = new Map<Kind, string[][]>();
  for (const k of slot ? (unasked ? [] : [slot]) : hits) {
    const a = QUOTE.has(k) ? wordsOf(quote(task, k)) : [];
    if (a.length) asks.set(k, a);
  }
  // Names every word of it, each as itself or a synonym: "data journalism" is not echarts' "big data".
  const says = (s: Scored, k: Kind) => s.why === "named in the brief" || asks.get(k)!.every((w) => namesIn(w, s.lib));
  // Go outside the look only when nothing curated for it fits, or only outsiders name what was asked: a minimal
  // counter gets number-flow, not rough-notation; a playful bottom sheet gets vaul, not a set of tactile sliders.
  const answers = (s: Scored) => hits.has(s.lib.kind) && (!asks.has(s.lib.kind) || says(s, s.lib.kind));
  const inLook = out.filter((s) => s.home && hits.has(s.lib.kind));
  const homeFits = !foundation && inLook.length > 0 && (inLook.some(answers) || !out.some((s) => !s.home && answers(s)));
  const fits = out.filter((s) => (!homeFits || s.home) && (s.fit > ruled || (s.fit === ruled && !peer) || spared.has(s.lib.id) || s.why === "named in the brief" || (!!slot && s.picked)));
  // One job: when a library of the asked kind names the ask, the rest of the kind do not fit (a typewriter headline is
  // not a hand-drawn underline). A plan slot leads with the one that names it instead, and keeps its alternatives.
  const off = new Set<Scored>();
  if (!slot)
    for (const k of asks.keys()) {
      const covers = (s: Scored) => s.lib.kind === k || !!s.lib.alsoCovers?.includes(k);
      if (fits.some((s) => covers(s) && says(s, k))) for (const s of fits) if (covers(s) && !says(s, k)) off.add(s);
    }
  return fits
    .filter((s) => !off.has(s))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 3)
    .map(({ home: _, fit: __, picked: ___, ...s }) => s);
}

/** `usable`: ids that run on the plan's framework, so a Svelte plan ranks shadcn-svelte as the look's first kit. */
function lookBonus(lib: Library, look: Aesthetic, usable?: Set<string>): number {
  let b = 0;
  const i = lib.aesthetic.indexOf(look.family ?? look.id); // libraries are tagged with families; a style inherits
  if (i >= 0) b += 2 - i * 0.4;
  for (const ids of Object.values(look.picks)) {
    const r = (usable ? ids?.filter((id) => usable.has(id)) : ids)?.indexOf(lib.id) ?? -1;
    if (r >= 0) b = Math.max(b, 8 - 2 * r); // the look's own picks should usually win
  }
  return b;
}

// Words after a part's own name that add nothing ("progress bar" is the Progress part).
const FILLER = new Set(["bar", "component", "element", "widget"]);
const NO_ALSO: Record<string, string[]> = { shader: ["webgl", "webgpu", "glsl", "three"], webgl: ["shader", "webgpu", "three"] };
const STILL = /no looping animation[^.;]*|nothing moves unless[^.;]*|^(?:almost )?none\b[^.;]*/i;
const MOVING: Kind[] = ["motion", "text-effects", "background"];
// Words that turn a part into another thing a kit's part of that name is not.
const KIND_OF = new Set(["masonry", "gantt", "org", "infinite", "virtual", "virtualized", "kanban", "tree", "flame", "sankey", "radar", "nested"].map(stem));
const QUALITY = new Set(["accessible", "simple", "basic", "custom", "styled", "responsive", "modern", "clean", "nice", "good", "small", "large", "big", "mobile", "keyboard", "searchable"].map(stem));

/** Kits whose own parts cover a job no specialist fits ("tabs" -> shadcn-ui's Tabs), the look's kit first. */
export function kitParts(libs: Library[], need: string, opts: { framework?: Framework; look?: Aesthetic } = {}) {
  // Only what the job asks for: "a striking hero, no gradients, no shaders" is no kit's Gradient Background.
  const { want: lower, not } = negations(need);
  const no = words(not).split(" ").filter((w) => w.length > 3 && !STOP.has(w));
  const all = lower.split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map(stem);
  const said = all.filter((w) => !FILLER.has(w));
  if (!said.length) return [];
  const q = new Set([...terms(lower), ...all]);
  const framework = opts.framework ?? "react"; // plans assume React too
  // A part must be named whole by the job, and name two of its words when it has two or more ("rich text editor", not
  // "Text"); a one-word part may be any word of a job that names no kind ("tabs, we use shadcn" -> Tabs): a gantt
  // chart is not a kit's Chart, nor a map's draggable marker its Marker.
  const min = Math.min(2, said.length);
  // ...unless the word right before it makes it a different thing: "masonry grid" is no kit's Grid, while "pricing
  // tabs", "profile avatar" and "with a progress bar" keep Tabs, Avatar and Progress.
  const tokens = lower.split(/[^a-z0-9]+/).filter((w) => w && !FILLER.has(stem(w)));
  const modified = tokens.slice(0, -1).some((w) => KIND_OF.has(stem(w)));
  const last = kindsIn(lower).size || modified ? undefined : said.at(-1); // set: one-word parts may match
  return libs
    .filter((l) => (l.kind === "component-kit" || l.kind === "primitives") && l.frameworks.includes(framework) && (!l.themed || (!!opts.look && lookBonus(l, opts.look) >= 4)))
    .flatMap((lib) => {
      // The most complete match wins: "OTP input" is a kit's Input OTP, not its Input.
      const part = lib.parts?.free.filter((p) => {
        const w = words(p.replace(/([a-z])([A-Z])/g, "$1 $2")).trim().split(" ");
        return (w.length >= min || (last !== undefined && w.length === 1 && q.has(w[0]!))) && w.every((t) => q.has(t)) && !w.some((t) => no.includes(t));
      }).sort((x, y) => y.split(/\s+/).length - x.split(/\s+/).length)[0];
      return part ? [{ lib, part, rank: (opts.look ? lookBonus(lib, opts.look) : 0) + MATURITY[lib.maturity] }] : [];
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3);
}


/** Whole lowercase words with plurals folded ("glass cards" = "glass card"), padded with spaces. No other stemming:
 * a look's words must be said as written, so "weather" is not "weathered". */
const plain = (s: string) =>
  ` ${s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map((w) => (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)).join(" ")} `;
// Everyday words that also name a look ("a smooth checkout", "clean code") and component words ("bottom sheet for
// filters") count for little and never pick a look on their own.
const WEAK = new Set(["smooth", "fluid", "soft", "clean", "simple", "raw", "fun", "calm", "warm", "quiet", "premium", "elegant", "natural", "friendly", "sheet", "bottom sheet", "gesture", "table", "blur", "physical"].map(plain));
// "in the Fluent look", "windows 98 style": a look's name or signal said with one of these names it outright.
const QUALIFIERS = ["look", "style", "styled", "aesthetic", "vibe", "theme", "feel", "inspired"];
type Phrases = { sigs: string[]; bare: string[]; all: string[] };
const phrases = new WeakMap<Aesthetic, Phrases>();
function phrasesOf(a: Aesthetic): Phrases {
  let p = phrases.get(a);
  if (p) return p;
  const sigs = a.signals.map(plain);
  // A family's id or name counts said bare ("playful fintech app"). So does a style's when it is two words or more
  // ("neo-brutalism", "Material You"); a one-word style name is an everyday word ("Fluent", "Memphis") until qualified.
  const names = a.family ? [a.id, ...a.name.replace(/\(.*?\)/g, "").split("/")].map(plain) : [plain(a.id), plain(a.name)];
  const bare = a.family ? names.filter((n) => n.trim().includes(" ")) : names;
  phrases.set(a, (p = { sigs, bare, all: [...new Set([...names, ...sigs])] }));
  return p;
}

/** Which looks a brief asks for, strongest first. Phrases beat single words; on a tie a style beats its family. */
export function detectLooks(looks: Aesthetic[], brief: string): Aesthetic[] {
  const text = plain(brief);
  // Each look's matched phrases: signals, names said bare, and names or signals said with a qualifier.
  const found = looks.map((a) => {
    const p = phrasesOf(a);
    const named = p.bare.filter((n) => text.includes(n));
    for (const n of p.all) if (text.includes(n)) {
      for (const w of QUALIFIERS) if (text.includes(`${n}${w} `)) named.push(`${n}${w} `);
      if (text.includes(` look${n}`)) named.push(` look${n}`); // "look: fluent", the site's copy-prompt form
      if (text.includes(` like${n}`)) named.push(` like${n}`); // "like Vercel": a reference brand names the look
    }
    return { a, named, sigs: p.sigs.filter((s) => text.includes(s)) };
  });
  // A phrase inside a longer one another look matched belongs to that look: "material design 3" is Material You, not
  // Material Design, and "bloomberg terminal style" is data-dense, not terminal.
  const mine = new Map(found.map((f) => [f.a, new Set([...f.named, ...f.sigs])]));
  const firstAt = (a: Aesthetic) => Math.min(...[...mine.get(a)!].map((t) => text.indexOf(t)).filter((i) => i >= 0), Infinity);
  const all = found.flatMap((f) => [...mine.get(f.a)!].map((t) => [t, f.a] as const));
  const shadowed = (s: string, a: Aesthetic) => all.some(([t, b]) => b !== a && t.length > s.length && t.includes(s) && !mine.get(a)!.has(t));
  const own = new Map(
    found.map(({ a, named, sigs }) => {
      const strong = named.some((n) => !shadowed(n, a)) ? 2 : 0;
      let s = strong, weak = 0;
      // A signal that is the look's own id ("cottagecore") names it outright, like a bare family name; not for the
      // corporate family's industry styles, whose ids are domains ("fintech app" is a domain, "playful" the look).
      const byId = (w: string) => w === plain(a.id) && !strong && a.family !== "corporate" ? 2 : 0;
      for (const w of sigs) if (!shadowed(w, a)) WEAK.has(w) ? (weak += 0.5) : (s += w.trim().split(" ").length + byId(w));
      // Weak and component words alone never pick a look: "a smooth checkout flow" stays on the default.
      return [a.id, s > 0 ? s + weak : 0] as const;
    }),
  );
  // A style refines its family, so words for the family count toward a style the brief also names
  // ("native ios ... bottom sheet" is ios-native, not just apple). A family still wins when no style matches.
  const total = (a: Aesthetic) => own.get(a.id)! + (a.family && own.get(a.id)! > 0 ? own.get(a.family) ?? 0 : 0);
  return looks
    .map((a) => ({ a, s: total(a) }))
    .filter((x) => own.get(x.a.id)! > 0)
    // Tied, the look the brief says first ("a risograph printed zine" is risograph; zine is the format).
    .sort((x, y) => y.s - x.s || Number(!!y.a.family) - Number(!!x.a.family) || firstAt(x.a) - firstAt(y.a))
    .map((x) => x.a);
}

/** What carries the page (3D, scroll motion, photo and video), if the brief says: most signal words, whole words only. */
function detectSite(brief: string): SiteType | undefined {
  const text = plain(brief);
  const said = (s: SiteType) => s.signals.map(plain).filter((sig) => text.includes(sig)).reduce((n, sig) => n + sig.trim().split(" ").length, 0);
  return siteTypes.map((s) => ({ s, n: said(s) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0]?.s;
}

export type PlanItem = { kind: Kind; pick?: Scored; alternatives: Scored[]; /** The base kit's part that covers it. */ part?: string };
export type Plan = {
  look: Aesthetic;
  lookGuessed: boolean;
  also: Aesthetic[];
  /** What carries the page apart from its look (3D, scroll motion, media): its picks lead their kinds. */
  site?: SiteType;
  items: PlanItem[];
  framework: Framework;
  frameworkGuessed: boolean;
  /** Kinds the brief ruled out ("no animation"). */
  skipped: Kind[];
  /** A kit the brief names that the registry does not curate ("we use chakra"): the plan keeps it and has no base pick. */
  uncurated?: string;
  /** The brief asks for dark but the look's ground is light (fintech is white by default). */
  darkOnLight?: boolean;
  /** A phone screen: touch targets and the on-screen keyboard matter. */
  mobile?: boolean;
};

/** Relative luminance of a #rgb/#rrggbb colour; undefined for gradients and other values. */
const luminance = (c: string) => {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)?.[1];
  if (!h) return undefined;
  const [r, g, b] = (h.length === 3 ? [...h].map((x) => x + x) : [h.slice(0, 2), h.slice(2, 4), h.slice(4)]).map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

const FRAMEWORK_WORDS: [Framework, RegExp][] = [
  ["react-native", /react native|expo\b/],
  ["vue", /\bvue\b|nuxt/],
  ["svelte", /svelte/],
  ["solid", /\bsolid(?:-?js\b| js\b| ?start\b)/], // "solid colour background" is not SolidJS
  ["angular", /angular/],
  ["vanilla", /vanilla|no framework|plain html/],
  ["react", /react|next\.?js|remix|tanstack|vite/],
];

const rankIn = (ids: string[], id: string) => (ids.includes(id) ? ids.indexOf(id) : ids.length);

/** Framework a brief names, if any. Pass the brief with its negations cut out: "not Angular" names no framework. */
export const detectFramework = (brief: string) => FRAMEWORK_WORDS.find(([, re]) => re.test(brief.toLowerCase()))?.[0];
/** The framework a single job runs on: the one it names, else React, as plans assume ("a Vue bottom sheet" is Vue). */
export const jobFramework = (need: string): Framework => detectFramework(negations(need).want) ?? "react";

// Popular kits the registry does not curate. Naming one keeps the project's kit instead of quietly swapping in another.
const ELSEWHERE: [string, RegExp][] = [
  ["chakra-ui", /\bchakra\b/], ["ant-design", /\bant ?design\b|\bantd\b/], ["bootstrap", /\bbootstrap\b(?! (?:a|an|the|my|our|this|new)\b)/],
  ["bulma", /\bbulma\b/], ["primereact", /\bprime ?react\b/], ["blueprintjs", /\bblueprint ?js\b/],
  ["element-plus", /\belement[ -]?plus\b/], ["quasar", /\bquasar\b/], ["naive-ui", /\bnaive[ -]?ui\b/],
  ["semantic-ui", /\bsemantic[ -]?ui\b/], ["flowbite", /\bflowbite\b/], ["tamagui", /\btamagui\b/],
  ["gluestack-ui", /\bgluestack\b/], ["ionic", /\bionic\b/], ["carbon", /\bcarbon design\b/], ["polaris", /\bpolaris\b/],
];

// Id words that name no particular kit ("xp-css" is named by "xp", not "css").
const GENERIC = new Set(["css", "ui", "js", "react", "kit", "components"]);
// Raw looks build on unstyled primitives; a kit would impose its own look.
const RAW: AestheticId[] = ["brutalist", "editorial", "luxury", "retro"];
// Bare nouns in a look's `avoid` list rule a kind out ("gradients and glass"); qualified ones ("gradients behind text") do not.
const BARE: [Kind, string[]][] = [
  ["background", ["shader", "gradient", "shader background", "gradient background", "animated background"]],
  ["motion", ["animation", "motion"]],
  ["glass", ["glass", "glassmorphism", "blur"]],
  ["scroll", ["smooth scroll", "smooth scroll library", "scroll jacking"]],
];
const avoided = (look: Aesthetic) => {
  const items = new Set(look.avoid.flatMap((a) => a.split(":")[0]!.split(/,|\bor\b|\band\b/).map(words)));
  return new Set(BARE.filter(([, nouns]) => nouns.some((n) => items.has(words(n)))).map(([k]) => k));
};

/** One pick per need for a whole app brief: the base kit first, then each need ranked to fit that kit and the look. */
export function plan(libs: Library[], looks: Aesthetic[], brief: string, opts: { framework?: Framework; look?: string } = {}): Plan {
  const { want, not } = negations(brief);
  const found = opts.look ? looks.filter((a) => a.id === opts.look) : detectLooks(looks, want);
  const fallback = looks.find((a) => a.id === "minimal") ?? looks[0];
  if (!fallback) throw new Error("registry has no aesthetics");
  const look = found[0] ?? fallback;
  const family = look.family ?? look.id;
  const named = opts.framework ?? detectFramework(want);
  const site = detectSite(want);
  // The site type's picks score as the look's own in its slots, so they are candidates even where the look has none.
  const tuned = site ? { ...look, picks: { ...look.picks, ...site.picks } } : look;
  const framework = named ?? "react";

  // A kit the brief names ("we use mantine", "on shadcn") is the base, whatever the look prefers.
  const said = words(want);
  const kit = libs.find((l) => (l.kind === "component-kit" || l.kind === "primitives") && l.frameworks.includes(framework) &&
    (said.includes(words(l.id)) || said.includes(words(l.name)) || (l.id.startsWith("shadcn-") && said.includes(" shadcn "))));
  // Next, a style's own kit (pixel-art's 8bitcn, neo-brutalism's restyled shadcn/ui) beats its family's base layer.
  // Picks a style leaves out are its family's (merged in the registry index), so "own" means different from the family's.
  const fam = looks.find((a) => a.id === look.family);
  const ownKind = fam && (["component-kit", "primitives"] as const).find((k) => look.picks[k]?.length && look.picks[k]!.join() !== fam.picks[k]?.join());
  const uncurated = kit ? undefined : ELSEWHERE.find(([, re]) => re.test(want))?.[0];
  // Only a foundation kit can be the base: magazine's device-mockup set (opensource-ui) is an extra, not an app's kit.
  // One whose own avoidWhen fits the brief better than its use cases is out ("Mac OS 9 Platinum": not 1-bit system.css),
  // and one whose avoidWhen fits it as well goes behind the rest ("federal benefits form": govuk-frontend says uswds).
  // Of several, the one the brief names by its id ("Windows XP" -> xp-css over 98-css), else one whose use cases it
  // clearly describes ("a coding-agent CLI in Ink" -> termcn over webtui), else the first.
  const ws = jobOf(want);
  const describes = (l: Library) => Math.max(0, ...l.useFor.map((u) => matched(ws, u)));
  const avoids = (l: Library) => avoidance(l, ws, 1).n;
  const fitting = (ownKind && !uncurated ? look.picks[ownKind]! : [])
    .flatMap((id) => libs.filter((l) => l.id === id && l.frameworks.includes(framework) && !isEffectsKit(l)))
    .filter((l) => avoids(l) < 2 || avoids(l) <= describes(l));
  const clear = fitting.filter((l) => !avoids(l) || avoids(l) < describes(l));
  const ownKits = clear.length ? clear : fitting;
  const own =
    ownKits.find((l) => l.id.split("-").some((w) => !GENERIC.has(w) && said.includes(` ${w} `))) ??
    ownKits.reduce<Library | undefined>((b, l) => (b && describes(l) < describes(b) + 2 ? b : l), undefined);
  const chosen = kit ?? own;
  const baseKind: Kind = kit?.kind ?? (own && ownKind) ?? (RAW.includes(family) && !uncurated ? "primitives" : "component-kit");
  // Unforced, never a kit that is mostly paid (Kobra): the base is the one thing a plan cannot swap out later.
  // An alternative base its own avoidWhen warns about is no alternative ("US government": not govuk-frontend).
  const ranked = kit || uncurated ? [] : pick(libs, brief, { framework, look, kind: baseKind, limit: 8 }).filter((s) => s.lib !== chosen && !paywalled(s.lib) && !(chosen && s.caution));
  const chosenItem: PlanItem = chosen
    ? { kind: baseKind, pick: { lib: chosen, score: 0, why: kit ? "named in the brief" : "look's own kit" }, alternatives: ranked.slice(0, 2) }
    : { kind: baseKind, pick: ranked[0], alternatives: ranked.slice(1, 3) };

  // Saying no to the kind itself ("without charts", "no animation") rules it out. Saying no to one technique while
  // asking for the kind in other words ("soft gradients, no shaders") keeps the slot; pick drops the shaders.
  const saysKind = (k: Kind) => new RegExp(`\\b(${k === "motion" ? "motion|animat" : k.replace(/s$/, "")})`).test(not);
  const ruledOut = new Set([...kindsIn(not)].filter((k) => saysKind(k) || !kindsIn(want).has(k)));
  const asked = kindsIn(want);
  // What the look adds unasked (glass adds a backdrop), minus what its own rules avoid (Memphis is flat: no shader). A
  // page gets no shader just for being a landing page, and a 3D scene is the page's one showpiece: no backdrop with it.
  const extras = new Set<Kind>(look.needs);
  for (const k of avoided(look)) extras.delete(k);
  if (asked.has("3d")) extras.delete("background");
  // A site type adds what carries it (a motion-led site scrubs and smooths scroll) whatever the look's motion rule, and
  // drops what fights it (a shader behind a video); what the brief itself asks for stays.
  for (const k of site?.needs ?? []) extras.add(k);
  for (const k of site?.drops ?? []) extras.delete(k);
  const needs = new Set([...asked, ...extras, "icons" as const]);
  const slotSaid = words(lookless(want, look));
  const slots = (layer: Library | undefined) => {
    const base = layer?.kind === "component-kit" ? layer : undefined;
    return NEEDS.map(([k]) => k).filter((k) => needs.has(k) && k !== baseKind && !ruledOut.has(k)).flatMap((kind): PlanItem[] => {
      // Under a kit we do not curate, shadcn registry items would drag in a second setup.
      const r = pick(libs, brief, { framework, look: tuned, kind, limit: 8, base }).filter((s) => !(uncurated && viaShadcn(s.lib)));
      // The project wins: a library the brief names for this job ("we use Tabler Icons") is the pick, like a named kit.
      const mine = libs.find((l) => l.kind === kind && l.frameworks.includes(framework) && (slotSaid.includes(words(l.name)) || slotSaid.includes(words(l.id))));
      if (mine) return [{ kind, pick: r.find((s) => s.lib === mine) ?? { lib: mine, score: 20, why: "named in the brief" }, alternatives: r.filter((s) => s.lib !== mine).slice(0, 2) }];
      // Libraries built for this kind lead, unless they belong to another kit; kits that merely cover it follow.
      // Among them, one whose tagline names what the brief asked for ("confetti") leads the look's general pick.
      const asks = [...terms(quote(want, kind))];
      const lead = (s: Scored) => 2 * Number(s.lib.kind === kind && !(base && offKit(s.lib, base))) + Number(names(asks, `${s.lib.tagline} ${s.why}`));
      r.sort((x, y) => lead(y) - lead(x));
      // The site type's picks lead their kinds whatever the look: a motion-led site scrubs with GSAP.
      const first = site?.picks[kind];
      if (first) r.sort((x, y) => rankIn(first, x.lib.id) - rankIn(first, y.lib.id));
      // Prefer what the base kit already ships over an extra install, unless a specialist is made to pair with it. It
      // must ship the thing asked for, not just the kind: Mantine's notifications are toasts, not confetti.
      if (base?.alsoCovers?.includes(kind) && (!asks.length || namesIn(asks, base, true)) && !r.some((s) => s.lib.kind === kind && pairs(s.lib, base))) {
        const ships = r.find((s) => s.lib === base) ?? { lib: base, score: 0, why: base.tagline };
        return [{ kind, pick: ships, alternatives: r.filter((s) => s !== ships && lead(s) >= 2).slice(0, 2) }];
      }
      // The look's pick shuns the base kit (Phosphor under shadcn/ui): the base kit's own pairing for this kind leads,
      // scored as the look's pick would have been on-kit (its -6 undone, +2 for pairing) so the stack is not docked.
      const mate = base && r[0] && offKit(r[0].lib, base) ? libs.find((l) => l.kind === kind && l.frameworks.includes(framework) && base.pairsWith?.includes(l.id)) : undefined;
      if (mate) return [{ kind, pick: { lib: mate, score: r[0]!.score + 8, why: `pairs with ${base!.name}` }, alternatives: r.slice(0, 2) }];
      if (r[0]) return [{ kind, pick: r[0], alternatives: r.slice(1, 3) }];
      if (!asked.has(kind)) return []; // the look added it, but nothing it picks runs on this framework (glass on React Native)
      // Nothing curated runs on this framework; the base kit may ship the part (panelui's BottomSheet on React Native).
      // When something does but none fits the job (a gantt chart), the kit's generic part does not either.
      const gap = !libs.some((l) => l.kind === kind && l.frameworks.includes(framework));
      const part = gap && layer && kitParts([layer], quote(want, kind), { framework })[0]?.part;
      return [part ? { kind, pick: { lib: layer, score: 0, why: part }, alternatives: [], part } : { kind, alternatives: [] }];
    });
  };
  const total = (b: Scored | undefined, items: PlanItem[]) => (b?.score ?? 0) + items.reduce((n, i) => n + (i.pick?.score ?? 0), 0);
  let baseItem = chosenItem;
  let items = slots(chosenItem.pick?.lib);
  // Unforced, choose the base by the whole stack it leads to: a kit that wins on its own words but strands the
  // best specialist for the brief's main job (Astryx vs assistant-ui for a chat app) loses to one that pairs.
  if (!chosen && !uncurated && baseKind === "component-kit")
    for (const [i, cand] of ranked.slice(1, 3).entries()) {
      const alt = slots(cand.lib);
      if (total(cand, alt) > total(baseItem.pick, items)) [baseItem, items] = [{ kind: baseKind, pick: cand, alternatives: ranked.filter((_, j) => j !== i + 1).slice(0, 2) }, alt];
    }
  return {
    look,
    lookGuessed: !found.length,
    also: found.slice(1, 3),
    site,
    items: [baseItem, ...items],
    framework,
    frameworkGuessed: !named,
    skipped: [...ruledOut],
    uncurated,
    darkOnLight: /\bdark\b/.test(want) && (luminance(look.swatch.bg) ?? 0) > 0.5,
    mobile: /\b(mobile|phone|iphone|android|ios app|pwa|expo|react native)\b/.test(want) || framework === "react-native",
  };
}
