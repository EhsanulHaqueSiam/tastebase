import assert from "node:assert/strict";
import { test } from "node:test";
import { detectLooks, kitParts, offKit, pick, plan } from "./engine.ts";
import { formatPlan, install } from "./format.ts";
import { aesthetics, libraries } from "./registry/index.ts";
import type { AestheticId, Framework, Kind } from "./registry/schema.ts";

const picks = (brief: string, framework?: Framework, look?: string) =>
  Object.fromEntries(plan(libraries, aesthetics, brief, { framework, look }).items.map((i) => [i.kind, i.pick?.lib.id]));
const top = (need: string) => pick(libraries, need)[0]?.lib.id;
const families = (brief: string) => detectLooks(aesthetics, brief).map((a) => a.family ?? a.id);

test("a look named in the brief drives the stack", () => {
  const p = picks("iOS-feel habit tracker with a bottom sheet and animated stats");
  assert.equal(p["component-kit"], "shadcn-ui");
  assert.equal(p.interaction, "vaul");
  assert.equal(p["text-effects"], "number-flow");
  assert.equal(p.glass, undefined); // apple's materials are CSS; a glass library only when asked or the look is glass
  assert.equal(p.icons, "lucide");
});

test("looks and needs match whole words, not fragments of them", () => {
  for (const [brief, wrong] of [
    ["software for accountants", "organic"], // soft
    ["client portal for a law firm", "technical"], // cli
    ["booking site for photo studios", "apple"], // ios
    ["settings drawer for a notes app", "brutalist"], // raw
    ["rapid prototyping tool", "technical"], // api
    ["notable quotes collection", "corporate"], // table
    ["fundraising page for a charity", "playful"], // fun
  ] as const) assert.ok(!families(brief).includes(wrong), `${brief} -> ${wrong}`);
  assert.equal(picks("typography heavy blog").charts, undefined); // graph
  assert.ok(families("dev-tool landing page").includes("technical")); // "dev tool"
  const minimal = aesthetics.find((a) => a.id === "minimal")!;
  assert.equal(detectLooks([minimal, { ...minimal, id: "test-style", family: "minimal" }], "a minimal app")[0]!.id, "test-style");
});

test("a named style or family beats domain words", () => {
  const first = (brief: string) => detectLooks(aesthetics, brief)[0]?.id;
  assert.equal(first("native ios habit tracker with a bottom sheet"), "ios-native"); // family words count toward the style
  assert.equal(first("minimal saas dashboard"), "minimal"); // not corporate, which lists saas and dashboard
  assert.equal(first("playful fintech app"), "playful");
  assert.equal(first("fintech banking app"), "fintech"); // the domain alone still picks its style
  // Everyday words and reference brands (round-7 review).
  assert.equal(first("dark mode analytics for devs, like Vercel"), "minimal");
  assert.equal(first("kids reading app with chunky buttons and bright colours"), "playful");
  assert.equal(first("website for a law firm, serious and trustworthy"), "corporate");
  assert.equal(first("a portfolio that looks like an old Mac"), "mac-classic");
  assert.equal(first("glassmorphism weather app with charts, bottom sheet and toasts"), "glassmorphism"); // not apple's "bottom sheet"
  assert.equal(first("retro windows 98 style personal homepage"), "retro-os"); // "windows 98 style" names it outright
  assert.equal(first("material design 3 settings screen"), "material-you"); // not Material Design 2's shorter phrase
  // Every look round-trips by id and name, in the phrasings the site's copy-prompt uses.
  for (const a of aesthetics)
    for (const n of [a.id, a.name]) for (const brief of [`landing page in the ${n} look`, `landing page, look: ${n}`]) assert.equal(first(brief), a.id, brief);
});

test("negations rule a kind out", () => {
  const p = picks("landing page without animations or gradients");
  assert.equal(p.motion, undefined);
  assert.equal(p.background, undefined);
  assert.equal(picks("dashboard with no animation").motion, undefined);
  assert.equal(picks("portfolio site, no shaders").background, undefined);
  assert.equal(picks("iOS-style settings, no motion").motion, undefined); // even when the look's identity would add it
  // "no X and Y" rules out X only; "without X and Y" rules out both.
  assert.ok(picks("minimal dashboard with no animation and charts").charts);
  assert.equal(picks("dashboard without animations and charts").charts, undefined);
});

test("plans add only what the brief or the look calls for", () => {
  for (const brief of ["chat app", "registration form", "product page for a shoe store"]) {
    const p = picks(brief, undefined, "minimal");
    assert.ok(!p.background && !p.motion, brief);
  }
  // No shader just for being a landing page (the AI look); a look whose backdrop is the point adds one.
  for (const brief of ["marketing site", "landing page", "crypto portfolio tracker"]) assert.equal(picks(brief).background, undefined, brief);
  assert.equal(picks("landing page like stripe").background, "paper-shaders"); // mesh gradient
  assert.equal(picks("landing page in the Aurora look").background, "paper-shaders");
  // A 3D scene is the page's one showpiece: no backdrop beside it, and in React it is react-three-fiber.
  const hero3d = picks("glassmorphism landing page with a 3d hero");
  assert.deepEqual([hero3d.background, picks("landing page with a 3d hero")["3d"]], [undefined, "r3f"]);
  assert.equal(picks("brutalist portfolio").background, undefined); // the look has no backdrop
  assert.equal(picks("swiss style portfolio").background, undefined);
  assert.equal(picks("landing page", undefined, "memphis").background, undefined); // its avoid list says no shader or gradient backgrounds
  assert.equal(picks("neo-brutalism landing page").background, undefined); // "gradients and glass"
});

test("a style's own kit wins the base layer over its family's", () => {
  assert.equal(picks("8-bit game site")["component-kit"], "8bitcn"); // pixel-art, in the primitives-first retro family
  assert.equal(picks("neo-brutalism portfolio")["component-kit"], "neobrutalism-components"); // a shadcn registry
  assert.equal(picks("windows 95 style fan site")["component-kit"], "98-css");
  assert.equal(picks("8-bit game site, we use mantine")["component-kit"], "mantine"); // the project still wins
  // An own kit its avoidWhen rules out is not the base; of two, the one the brief's words fit.
  assert.equal(picks("Mac OS 9 Platinum desktop").primitives, "base-ui"); // system.css is 1-bit System 6
  for (const brief of ["US government benefits application form", "federal benefits application form"]) assert.equal(picks(brief)["component-kit"], "uswds", brief);
  for (const brief of ["UK council parking permit application", "government benefits application form"]) assert.equal(picks(brief)["component-kit"], "govuk-frontend", brief);
});

test("effects kits and mostly paid kits never become the base layer", () => {
  assert.equal(picks("dev-tool landing page like Resend with a shader hero")["component-kit"], "shadcn-ui");
  // shadcn/ui's avoidWhen sends motion-first landing pages to Magic UI on top of it: a warning, not a reason for Kobra.
  const base = plan(libraries, aesthetics, "landing page with animations").items[0]!;
  assert.equal(base.pick?.lib.id, "shadcn-ui");
  assert.match(base.pick?.caution ?? "", /magic-ui/);
  assert.ok([base, ...plan(libraries, aesthetics, "product that should feel crafted like Linear").items.slice(0, 1)].every((i) => i.pick?.lib.id !== "kobra"));
});

test("one coherent stack: a named kit is the base and the rest fits it", () => {
  const m = picks("admin panel, we use mantine, with charts and toasts");
  assert.equal(m["component-kit"], "mantine");
  assert.equal(m.feedback, "mantine"); // its notifications, not sonner, which pairs with shadcn/ui
  assert.equal(picks("playful app using Mantine with confetti on completion").feedback, "canvas-confetti"); // notifications are not confetti
  // A kit we do not curate is kept, not swapped for one we do, and nothing that installs into another kit is added.
  const chakra = plan(libraries, aesthetics, "we use chakra, admin dashboard with animations");
  assert.deepEqual([chakra.uncurated, chakra.items[0]!.pick], ["chakra-ui", undefined]);
  assert.match(formatPlan(chakra), /chakra-ui is not curated; keep the project's kit/);
  assert.ok(chakra.items.every((i) => !i.pick?.lib.install.includes("shadcn@")));
  assert.equal(picks("brutalist portfolio on shadcn")["component-kit"], "shadcn-ui");
  const [base, ...rest] = plan(libraries, aesthetics, "AI chat app like Claude with tool calls").items.map((i) => i.pick!.lib);
  assert.deepEqual(rest.filter((l) => offKit(l, base!)).map((l) => l.id), []);
  // Chosen as a whole stack: the kit whose chat specialist pairs with it, not the kit with built-in chat.
  assert.deepEqual([base!.id, rest[0]!.id], ["shadcn-ui", "ai-elements"]);
});

test("raw looks build on primitives, and the framework is read from the brief", () => {
  assert.equal(picks("luxury fashion store, editorial, smooth scroll").primitives, "base-ui");
  const vue = plan(libraries, aesthetics, "nuxt marketing site with liquid glass cards");
  assert.equal(vue.framework, "vue");
  assert.ok(vue.items.every((i) => !i.pick || i.pick.lib.frameworks.includes("vue")));
  // Only affirmative mentions name a framework, and a solid colour is not SolidJS.
  for (const [brief, fw] of [
    ["React dashboard, not Angular, with charts", "react"],
    ["Next.js app with a solid color background", "react"],
    ["SolidJS dashboard", "solid"],
    ["solid start app", "solid"],
  ] as const) assert.equal(plan(libraries, aesthetics, brief).framework, fw, brief);
});

test("installs match the plan's framework and base kit", () => {
  const bn = formatPlan(plan(libraries, aesthetics, "React Notion-like block editor on shadcn"));
  assert.match(bn, /@blocknote\/shadcn/);
  assert.doesNotMatch(bn, /@blocknote\/mantine|@mantine/);
  const ids = new Set(libraries.map((l) => l.id));
  assert.deepEqual(libraries.flatMap((l) => Object.keys(l.installWith ?? {}).filter((k) => !ids.has(k))), []);
  const expo = formatPlan(plan(libraries, aesthetics, "Expo habit tracker with animated stats and a bottom sheet"));
  assert.doesNotMatch(expo, /@react-spring\/web|lucide-react(?!-native)|plain CSS/);
  assert.doesNotMatch(formatPlan(plan(libraries, aesthetics, "vue dashboard with charts and icons")), /lucide-react/);
  assert.match(formatPlan(plan(libraries, aesthetics, "vue admin app with toasts")), /npm i vue-sonner/);
  // The site's plan and the MCP answer resolve installs with the same function.
  const lib = (id: string) => libraries.find((l) => l.id === id)!;
  assert.equal(install(lib("lucide"), "vue"), "npm i @lucide/vue");
  assert.match(install(lib("blocknote"), "react", lib("shadcn-ui")), /@blocknote\/shadcn/);
});

// Single jobs as an agent passes them to pick, several phrasings each. Each row: the job, what a senior design engineer
// would install ("a|b": either; null: nothing curated fits), ids that must not show at all, and for a null row the kit
// part that covers it (null: no kit part either; a gantt chart is not a kit's Chart).
type Job = [need: string, top: string | null, never?: string[], part?: string | null];
const JOBS: Job[] = [
  ["typewriter headline", "gsap-splittext|use-scramble", ["rough-notation", "torph"]],
  ["typewriter effect on the hero title", "gsap-splittext|use-scramble", ["rough-notation"]],
  ["text that types itself out letter by letter", "use-scramble|gsap-splittext", ["rough-notation"]],
  ["copy button that confirms", "torph"],
  ["button label that changes from Copy to Copied", "torph"],
  ["animated price", "number-flow"],
  ["pricing toggle that animates the price", "number-flow"],
  ["live crypto prices ticker", "number-flow", ["lightweight-charts"]],
  ["stock price ticker", "number-flow"],
  ["hand-drawn underline on a headline word", "rough-notation"],
  ["decrypt text effect on hover", "use-scramble"],
  ["headline that reveals line by line", "gsap-splittext"],
  ["scroll-triggered animations", "motion|gsap", ["tw-animate-css"]],
  ["animate cards as they scroll into view", "motion|gsap", ["tw-animate-css"]],
  ["fade in elements on scroll", "motion|gsap", ["lenis", "tw-animate-css"]],
  ["reveal sections on scroll", "gsap|motion", ["tw-animate-css"]],
  ["dialog that animates out before it unmounts", "motion"],
  ["pinned section that scrubs as you scroll", "gsap"],
  ["list items that animate when added or removed", "motion|auto-animate"],
  ["toast after save", "sonner", ["mantine"]],
  ["success notification", "sonner", ["bencho"]],
  ["undo toast after deleting items", "sonner"],
  ["upload progress toast", "sonner|ding"],
  ["progress bar", null, ["sonner", "ding", "amicro", "nes-css", "xp-css", "motion"], "Progress"],
  ["file upload page with a progress bar", null, ["sonner", "ding", "amicro"], "Progress"],
  ["skeleton loader", "skullet", ["dot-matrix"]],
  ["loading skeleton for a profile card", "skullet"],
  ["confetti when a payment completes", "canvas-confetti"],
  ["loading spinner", "amicro|dot-matrix"],
  ["bottom sheet", "vaul"],
  ["mobile bottom sheet with snap points", "vaul"],
  ["kanban drag and drop", "dnd-kit"],
  ["image carousel", "embla-carousel"],
  ["pinch to zoom an image", "use-gesture"],
  ["React map with draggable markers", null, ["vaul", "use-gesture", "rare-ui"], null],
  ["map with draggable pins", null, ["vaul", "use-gesture"]],
  ["drag and drop file upload", null, ["dnd-kit", "vaul"]], // dnd-kit says: a dropzone
  ["gantt chart", null, ["lightweight-charts", "recharts", "echarts"], null],
  ["project timeline gantt", null, ["lightweight-charts"]],
  ["org chart", "echarts", ["lightweight-charts", "recharts"]], // its tree series
  ["company org chart", "echarts", ["lightweight-charts"]],
  ["candlestick chart for a trading app", "lightweight-charts"],
  ["line chart in a React dashboard", "recharts"],
  ["revenue chart", "recharts|echarts", ["lightweight-charts"]],
  ["infinite scroll list", null, ["lenis", "scrollama"]],
  ["infinite scrolling feed", null, ["lenis", "scrollama"]],
  ["smooth scroll", "lenis"],
  ["scroll progress bar", "motion", ["lenis"]],
  ["date picker", "react-aria", ["mui", "uswds"]],
  ["date range picker", "react-aria", ["mui", "uswds"]],
  ["tabs", null, [], "Tabs"],
  ["file upload dropzone", null],
  ["accessible combobox", null, [], "Combobox"], // the last word names it
  ["React app with a text editor for Python code", null, ["tiptap", "blocknote"]], // they say: CodeMirror or Monaco
  ["Python code editor", null, ["tiptap", "blocknote"]],
  ["code editor with syntax highlighting", null, ["tiptap", "blocknote"]],
  ["rich text editor", "tiptap"],
  ["notion-like block editor", "blocknote"],
  ["data table with sorting and filters", "tanstack-table"],
  ["command palette", "cmdk"],
  ["hero shader background", "paper-shaders"],
  ["3d product viewer", "model-viewer"],
  ["chat interface with streaming messages", "ai-elements|assistant-ui|prompt-kit"],
  // A word before a part names which one ("pricing tabs"); only a kind-changing word makes it something else.
  ["pricing tabs", null, [], "Tabs"],
  ["profile avatar", null, [], "Avatar"],
  ["settings switch", null, [], "Switch"],
  ["ingredients checklist checkbox", null, [], "Checkbox"],
  ["masonry grid", null, [], null],
  ["infinite scroll list", null, [], null],
  // Round-4 review (Sol): unrelated domains abstain, and "typing" is the typewriter job.
  ["Python source editor", null, ["playcanvas", "tiptap"]],
  ["stream a video player", null, ["assistant-ui", "ai-elements", "prompt-kit"]],
  ["animated typing headline", "gsap-splittext|use-scramble"],
  // Round-5 review (Sol): the object of the job beats incidental words.
  ["tiny sparkline showing the last 7 days of Bitcoin price", "recharts|bklit-ui"],
  ["drag to resize split panes", null, ["formkit-drag-and-drop", "dnd-kit", "pragmatic-drag-and-drop"]],
  ["flowchart editor with connecting nodes", "xyflow", ["babylonjs"]],
  // Round-6 review (Opus): rewordings of the node-editor job, reorder, and "no shaders" covering WebGL too.
  ["node graph editor", "xyflow", ["unovis", "echarts", "visx"]],
  ["drag nodes and connect them with edges", "xyflow"],
  ["drag to reorder list items", "dnd-kit"],
  ["hero background, no shaders, subtle", "react-bits|kokonut-ui|tsparticles|cult-ui", ["paper-shaders", "shadergradient", "canvas-ui", "r3f"]],
  ["resizable split panes", null, [], "Resizable"],
  ["tabs, we use shadcn", "animate-ui", [], "Tabs"], // the MCP answer leads with shadcn-ui (Tabs)
  // Round-6 review (Sol): rewordings again; "animation" only says how, the named thing is the job.
  ["headline with a typing animation", "gsap-splittext|use-scramble"],
  ["drag the divider to resize two panes", null, ["formkit-drag-and-drop", "dnd-kit", "pragmatic-drag-and-drop"]],
  ["a graph editor to link workflow nodes", "xyflow", ["echarts", "unovis", "visx"]],
  ["one-time password input", "base-ui|kobra|rare-ui", ["prompt-kit", "gsap-splittext"]],
];

test("single jobs land on the specialist, or on nothing", () => {
  for (const [need, best, never = [], part] of JOBS) {
    const ids = pick(libraries, need).map((s) => s.lib.id);
    if (best) assert.ok(best.split("|").includes(ids[0]!), `${need}: got ${ids.join(", ") || "nothing"}`);
    else assert.deepEqual(ids, [], need);
    assert.deepEqual(ids.filter((id) => never.includes(id)), [], `${need}: shown`);
    const parts = kitParts(libraries, need).map((k) => k.part);
    if (part) assert.ok(parts.includes(part), `${need}: parts ${parts.join(", ")}`);
    if (part === null) assert.deepEqual(parts, [], `${need}: parts`);
  }
  assert.equal(pick(libraries, "kanban drag and drop")[0]?.caution, undefined); // dnd-kit's avoidWhen names drag-and-drop libraries, not this job
  assert.ok(kitParts(libraries, "tabs").some((k) => k.lib.id === "shadcn-ui" && k.part === "Tabs"));
  assert.ok(kitParts(libraries, "rich text editor").some((k) => k.lib.id === "mantine"));
});

test("reasons come from the brief or the look, never a stray word", () => {
  const why = (brief: string, kind: Kind) => plan(libraries, aesthetics, brief).items.find((i) => i.kind === kind)?.pick?.why ?? "";
  assert.doesNotMatch(why("luxury fashion ecommerce store", "icons"), /Material/);
  assert.doesNotMatch(why("react native habit tracker with animations", "motion"), /three-fiber/);
  assert.doesNotMatch(why("liquid glass music player", "background"), /liquid-metal/); // a slot the look added: its pick
});

// Realistic briefs with what a senior design engineer would choose. Each row: brief, look ("?" = none named, so the
// default), base kit ("*" = not pinned, "-" = none), every slot the plan should have, picks that must hold (null: nothing curated),
// and ids that must not appear anywhere. Every row also checks that picks run on the framework and that no themed kit
// (98.css, NES.css, GOV.UK) shows up unless the look picks it. Stats-free: the registry carries none in tests.
type Golden = [brief: string, look: string, base: string, slots: string, must?: Partial<Record<Kind, string | null>>, never?: string[]];
const GOLDEN: Golden[] = [
  ["a smooth checkout flow", "?", "shadcn-ui", "component-kit icons", {}, ["glisse"]],
  ["bottom sheet for filters", "?", "shadcn-ui", "component-kit interaction icons", { interaction: "vaul" }],
  ["weather app", "?", "shadcn-ui", "component-kit icons"],
  ["glassmorphism weather app with charts, bottom sheet and toasts", "glassmorphism", "shadcn-ui", "component-kit interaction feedback glass background charts icons", { glass: null, interaction: "vaul", feedback: "sonner" }, ["glisse", "liquid-glass-react"]],
  ["glassmorphism dashboard", "glassmorphism", "shadcn-ui", "component-kit glass background charts icons", { glass: null }],
  ["liquid glass music player", "liquid-glass", "shadcn-ui", "component-kit glass background icons", { glass: "glisse" }, ["7-css"]],
  ["iOS-feel habit tracker with a bottom sheet and animated stats", "apple", "shadcn-ui", "component-kit motion text-effects interaction icons", { interaction: "vaul", "text-effects": "number-flow" }],
  ["native ios habit tracker with a bottom sheet", "ios-native", "konsta", "component-kit motion interaction icons", { interaction: "vaul" }],
  ["landing page in the Fluent look", "fluent", "fluent-ui", "component-kit icons", { icons: "fluent-icons" }, ["98-css", "xp-css"]],
  ["landing page in the Memphis look", "memphis", "heroui", "component-kit motion icons"],
  ["landing page in the Aurora look", "aurora", "shadcn-ui", "component-kit background icons", { background: "paper-shaders" }],
  ["retro windows 98 style personal homepage", "retro-os", "98-css", "component-kit icons", {}, ["paper-shaders"]],
  ["Windows XP desktop", "retro-os", "xp-css", "component-kit icons"],
  ["web1 personal homepage with a guestbook", "web1", "base-ui", "primitives icons", {}, ["paper-shaders"]],
  ["retro terminal portfolio", "terminal", "webtui", "component-kit icons"],
  ["coding agent CLI in Ink", "terminal", "termcn", "component-kit agent-ui icons"],
  ["8-bit game site", "pixel-art", "8bitcn", "component-kit icons", { icons: "pixelarticons" }],
  ["neo-brutalism portfolio", "neo-brutalism", "neobrutalism-components", "component-kit icons"],
  ["claymorphism kids app with progress and confetti", "claymorphism", "heroui", "component-kit motion feedback icons", { feedback: "canvas-confetti" }, ["nes-css"]],
  ["playful fintech app with animated balances", "playful", "heroui", "component-kit motion text-effects icons", { "text-effects": "number-flow" }],
  ["minimal dashboard with no animation and charts", "minimal", "shadcn-ui", "component-kit charts icons", { charts: "recharts" }],
  ["landing page without animations or gradients", "?", "shadcn-ui", "component-kit icons"],
  ["kanban board for a team", "?", "shadcn-ui", "component-kit interaction icons", { interaction: "dnd-kit" }, ["blocknote"]],
  ["animated number counter", "?", "shadcn-ui", "component-kit motion text-effects icons", { "text-effects": "number-flow" }, ["rough-notation"]],
  ["drag and drop file upload", "?", "shadcn-ui", "component-kit interaction icons", { interaction: null }, ["blocknote", "vaul"]],
  ["Python code editor", "?", "shadcn-ui", "component-kit editor icons", { editor: null }, ["tiptap", "blocknote"]],
  ["editor app", "?", "shadcn-ui", "component-kit editor icons", { editor: "tiptap" }],
  ["notes app", "document", "shadcn-ui", "component-kit editor icons", { editor: "blocknote" }],
  ["docs editor", "document", "shadcn-ui", "component-kit editor icons"],
  ["notion style block editor", "document", "shadcn-ui", "component-kit editor icons", { editor: "blocknote" }, ["shadergradient"]],
  ["React Notion-like block editor on shadcn", "document", "shadcn-ui", "component-kit editor icons", { editor: "blocknote" }],
  ["data journalism site", "?", "shadcn-ui", "component-kit charts icons", {}, ["pele"]],
  ["data story about rents", "scrollytelling", "base-ui", "primitives charts scroll icons", { scroll: "scrollama" }],
  ["luxury fashion ecommerce store", "luxury", "base-ui", "primitives motion icons", {}, ["material-symbols"]],
  ["dev-tool landing page like Resend with a shader hero", "technical", "shadcn-ui", "component-kit background icons", { background: "paper-shaders" }],
  ["dev-tool landing page like Linear with a shader hero", "dark-minimal", "shadcn-ui", "component-kit background icons", { background: "paper-shaders" }], // the brief's ask beats the look's no-shader default
  ["admin panel, we use mantine, with charts and toasts", "corporate", "mantine", "component-kit feedback charts icons", { feedback: "mantine" }],
  ["bloomberg terminal style trading dashboard", "data-dense", "mantine", "component-kit charts tables icons", { tables: "ag-grid" }],
  ["government benefits application form", "civic", "govuk-frontend", "component-kit icons"],
  ["material design 3 settings screen", "material-you", "*", "component-kit motion icons", { icons: "material-symbols" }],
  ["nuxt marketing site with liquid glass cards", "liquid-glass", "nuxt-ui", "component-kit glass icons", {}, ["wired-elements"]],
  ["vue admin app with toasts", "corporate", "shadcn-vue", "component-kit feedback icons", { feedback: "sonner" }, ["canvas-confetti", "skullet", "ding"]], // vue-sonner
  ["svelte app with toasts", "?", "shadcn-svelte", "component-kit feedback icons", { feedback: "sonner" }],
  ["playful app using Mantine with confetti on completion", "playful", "mantine", "component-kit motion feedback icons", { feedback: "canvas-confetti" }],
  ["landing page with animations", "?", "shadcn-ui", "component-kit motion icons", { motion: "motion" }, ["kobra", "paper-shaders"]],
  ["we use chakra, admin dashboard", "corporate", "-", "component-kit charts icons", {}, ["mantine", "shadcn-ui"]],
  ["Mac OS 9 Platinum desktop", "mac-classic", "base-ui", "primitives icons", {}, ["system-css"]],
  ["US government benefits application form", "civic", "uswds", "component-kit icons", {}, ["govuk-frontend"]],
  ["landing page with a 3d hero", "?", "shadcn-ui", "component-kit motion 3d icons", { "3d": "r3f", motion: "gsap" }, ["paper-shaders"]], // a 3D site: its scroll and camera moves run on GSAP
  ["crypto portfolio tracker", "fintech", "shadcn-ui", "component-kit text-effects icons", { "text-effects": "number-flow" }, ["paper-shaders"]], // fintech's amounts roll
  // Eval 4: briefs in a founder's words.
  ["Home screen for Nest, our savings app for people in their twenties: this month savings goal, round-ups, one big button to move money in. Friendly and trustworthy.", "fintech", "shadcn-ui", "*", { "text-effects": "number-flow" }],
  ["Landing page for Slow Batch, a subscription. Feel like a risograph printed zine, two inks, grainy, a little off-register.", "risograph", "*", "*"],
  ["Svelte page where our podcast creators schedule a new episode: date and time, a switch for paid subscribers only, tag the guests. Calm and modern.", "*", "shadcn-svelte", "*"],
  ["React dashboard, not Angular, with charts", "corporate", "shadcn-ui", "component-kit charts icons", { charts: "recharts" }],
  ["Next.js app with a solid color background", "?", "shadcn-ui", "component-kit icons"],
  ["landing page like stripe", "mesh-gradient", "shadcn-ui", "component-kit background icons", { background: "paper-shaders" }],
  ["file upload page with a progress bar", "?", "shadcn-ui", "component-kit icons", {}, ["sonner", "ding", "amicro"]],
  ["React map with draggable markers", "?", "shadcn-ui", "component-kit interaction icons", { interaction: null }, ["vaul", "use-gesture", "rare-ui"]],
  ["React app with a text editor for Python code", "?", "shadcn-ui", "component-kit editor icons", { editor: null }, ["tiptap", "blocknote"]],
  ["project management app with a gantt chart", "?", "shadcn-ui", "component-kit charts icons", { charts: null }, ["recharts", "lightweight-charts"]],
  ["svelte admin with a data table", "corporate", "shadcn-svelte", "component-kit tables icons", { tables: "tanstack-table" }, ["skullet", "govuk-frontend"]],
  ["svelte landing page with smooth scroll", "?", "shadcn-svelte", "component-kit scroll icons", { scroll: "lenis" }],
  ["Expo habit tracker with animated stats and a bottom sheet", "?", "*", "component-kit motion text-effects interaction icons", {}, ["glisse", "vaul"]],
  ["Expo meditation app with a bottom sheet", "organic", "panelui", "component-kit interaction icons", { interaction: "panelui" }], // its BottomSheet part
  ["angular admin dashboard with a data table and toasts", "corporate", "spartan-ng", "component-kit feedback charts tables icons", {}, ["skullet"]],
  ["plain html government service page", "civic", "govuk-frontend", "component-kit icons"],
  ["vanilla js landing page with a shader hero", "?", "*", "component-kit background icons", { background: "paper-shaders" }],
  // From building real screens with the shipped skill: one kit, a chart when spending is broken down.
  ["Notes app on mobile with a Notion-like editor, minimal. Vite + React + Tailwind.", "document", "shadcn-ui", "component-kit editor icons", { editor: "blocknote" }],
  ["admin panel with no tailwind, charts and toasts", "corporate", "mantine", "component-kit feedback charts icons"], // "no Tailwind" is shadcn/ui's own avoid line
  ["Budgeting app home screen for a neobank: balance, spending by category, recent transactions.", "fintech", "shadcn-ui", "component-kit text-effects charts icons", { charts: "recharts", "text-effects": "number-flow" }],
  ["pricing page with a plan breakdown", "?", "shadcn-ui", "component-kit icons"],
  // Round-4 review: a technique said no to keeps its kind; a celebration is confetti; a dark brief on a light look.
  ["meditation app, calm, soft gradients, no shaders", "*", "*", "*", {}, ["paper-shaders", "shadergradient"]],
  ["habit tracker for kids, streak celebration", "playful", "*", "*", { feedback: "canvas-confetti" }], // "kids" is playful
  ["React site rather than Angular with charts", "*", "shadcn-ui", "*", { charts: "recharts" }, ["spartan-ng", "angular-material"]],
  ["Vue dashboard with a plain blue background", "*", "shadcn-vue", "component-kit charts icons", {}, ["ogl", "paper-shaders"]], // a CSS colour
  ["React page, no motion and no gradients", "*", "*", "*", {}, ["paper-shaders", "shadergradient", "motion"]],
  ["We use Mantine and Tabler Icons. Settings page with toasts", "*", "mantine", "*", { icons: "tabler-icons" }],
  // Eval 3: a flowchart canvas is an editor job the plan must fill, not leave to hand-building.
  ["Workflow automation builder: a flowchart of triggers and actions, dark, technical.", "*", "*", "*", { editor: "xyflow" }],
  ["Vue flowchart editor with connecting nodes", "*", "shadcn-vue", "*", { editor: null }, ["tiptap"]], // React Flow has no Vue build
  // The design eval's briefs, word for word: every job each page needs, each with its library.
  ["Pricing page for Tally, an invoicing tool for freelancers: three plans and an FAQ. Quiet and clean, like Linear.", "dark-minimal", "shadcn-ui", "component-kit icons", {  }],
  ["Home screen for Stride, a habit tracker: today's habits, a weekly streak, and a bottom sheet to add a habit. It should feel like a native iOS app.", "ios-native", "konsta", "component-kit motion text-effects interaction icons", { motion: "motion", "text-effects": "number-flow", interaction: "vaul" }],
  ["Now-playing screen for a music player in the visionOS style: frosted, translucent panels over the album art.", "spatial", "shadcn-ui", "component-kit glass background icons", { glass: "glisse", background: "paper-shaders" }],
  ["Lesson-complete screen for a kids' spelling game: the stars earned, the streak, and a button to start the next lesson.", "playful", "heroui", "component-kit motion text-effects feedback icons", { motion: "motion", "text-effects": "number-flow", feedback: "canvas-confetti" }],
  ["Landing page for a type foundry's new typeface. Brutalist: raw, heavy type, hard edges.", "brutalist", "base-ui", "primitives icons", {  }],
  ["Article page for a long read about post-war housing in an online architecture magazine.", "editorial", "base-ui", "primitives icons", {  }],
  ["Leaderboard for a pixel-art arcade game.", "pixel-art", "8bitcn", "component-kit icons", {  }],
  ["Landing page for a cyberpunk racing game.", "cyberpunk", "base-ui", "primitives background icons", { background: "paper-shaders" }],
  ["Admin dashboard for a logistics company: a KPI row, a shipments table and one chart.", "corporate", "mantine", "component-kit charts tables icons", { charts: "recharts", tables: "tanstack-table" }],
  ["Landing page for Relay, an email API for developers, with a code sample.", "technical", "shadcn-ui", "component-kit code icons", { code: "shiki" }],
  ["Product page for a fine jewellery house's new ring collection.", "luxury", "base-ui", "primitives motion interaction icons", { motion: "gsap", interaction: "embla-carousel" }],
  ["Home screen for a meditation app with a breathing exercise.", "organic", "shadcn-ui", "component-kit motion icons", { motion: "motion" }],
  ["Stats page for a podcast host: downloads over time as a chart, the top episodes, a command menu on cmd+k to jump between shows, and a toast when a report is exported.", "?", "shadcn-ui", "component-kit text-effects feedback command charts icons", { "text-effects": "number-flow", feedback: "sonner", command: "cmdk", charts: "recharts" }],
  ["Support chat for a bank's app: an assistant that streams its answers, suggested first questions, and a thumbs up or down on each answer.", "?", "shadcn-ui", "component-kit agent-ui icons", { "agent-ui": "prompt-kit" }],
];

test("golden briefs get what a senior design engineer would pick", () => {
  for (const [brief, look, base, slots, must = {}, never = []] of GOLDEN) {
    const p = plan(libraries, aesthetics, brief);
    if (look !== "*") assert.equal(p.lookGuessed ? "?" : p.look.id, look, `${brief}: look`);
    if (base !== "*") assert.equal(p.items[0]?.pick?.lib.id ?? "-", base, `${brief}: base`);
    if (slots !== "*") assert.deepEqual(p.items.map((i) => i.kind), slots.split(" "), `${brief}: slots`);
    for (const [kind, id] of Object.entries(must)) assert.equal(p.items.find((i) => i.kind === kind)?.pick?.lib.id ?? null, id, `${brief}: ${kind}`);
    const shown = p.items.flatMap((i) => [i.pick, ...i.alternatives]).flatMap((s) => (s ? [s.lib] : []));
    const lookPicks = new Set(Object.values(p.look.picks).flat());
    assert.deepEqual(shown.filter((l) => never.includes(l.id) || (l.themed && !lookPicks.has(l.id)) || !l.frameworks.includes(p.framework)).map((l) => l.id), [], `${brief}: shown`);
  }
});

// What carries the page is separate from its look: its picks lead their kinds, and what fights it is left out.
const sites: { brief: string; site: string | undefined; has?: Partial<Record<Kind, string>>; lacks?: Kind[] }[] = [
  { brief: "immersive 3D product landing page with three.js", site: "3d-site", has: { "3d": "r3f", motion: "gsap" }, lacks: ["background"] },
  { brief: "svelte 3d configurator", site: "3d-site", has: { "3d": "three" } },
  { brief: "awwwards style agency site with scroll animations", site: "motion-site", has: { motion: "gsap", scroll: "lenis", "text-effects": "gsap-splittext" } },
  { brief: "cinematic video hero landing page for a film studio", site: "media-site", lacks: ["background"] },
  { brief: "luxury watch boutique with full-bleed photography", site: "media-site", lacks: ["charts", "background"] },
  { brief: "video call app", site: undefined },
];
for (const r of sites)
  test(`site: ${r.brief}`, () => {
    const p = plan(libraries, aesthetics, r.brief);
    const got = Object.fromEntries(p.items.map((i) => [i.kind, i.pick?.lib.id]));
    assert.equal(p.site?.id, r.site);
    for (const [kind, id] of Object.entries(r.has ?? {})) assert.equal(got[kind], id, kind);
    for (const kind of r.lacks ?? []) assert.ok(!(kind in got), `${kind} is not needed`);
  });

// What people type, and what they must get. Looks are compared by family ("like Linear" is dark-minimal, a minimal
// style). `miss` marks a row the engine gets wrong today; the test then asserts
// it still fails, so a fix (or a lucky new library) shows up as "delete the miss".
type Brief = { brief: string; look: AestheticId | "default"; framework?: Framework; has?: Partial<Record<Kind, string>>; lacks?: Kind[]; miss?: string };
const briefs: Brief[] = [
  { brief: "like Linear but for invoices", look: "minimal" },
  { brief: "clean quiet settings page", look: "default" }, // everyday words never name a look alone; the default is minimal
  { brief: "I want it to feel like iOS", look: "apple", has: { interaction: "vaul" }, lacks: ["glass"] },
  { brief: "admin dashboard with tables and charts", look: "corporate", has: { "component-kit": "mantine", charts: "recharts" } },
  { brief: "internal CRM for sales team", look: "corporate" },
  { brief: "docs site for an open source CLI", look: "technical" },
  { brief: "landing page for my API product, like Resend", look: "technical", lacks: ["background"] }, // no shader for being a landing page
  { brief: "magazine style longform article page", look: "editorial", has: { primitives: "base-ui", scroll: "lenis" } },
  { brief: "pixel art game leaderboard", look: "retro", has: { icons: "pixelarticons" } },
  { brief: "wedding invitation site, elegant", look: "luxury", miss: "'elegant' is an everyday word that never names a look alone, and 'wedding' is no signal" },
  { brief: "onboarding flow for a duolingo style language app", look: "playful" },
  { brief: "visionOS style music player with frosted panels", look: "glass", has: { glass: "glisse" } },
  { brief: "meditation app with breathing exercise", look: "organic" },
  { brief: "simple brutalist portfolio", look: "brutalist" },
  { brief: "todo app", look: "default" },
  { brief: "AI chat assistant with streaming answers", look: "default", has: { "agent-ui": "ai-elements" } },
  { brief: "e-commerce product page with image carousel", look: "default", has: { interaction: "embla-carousel" } },
  { brief: "svelte kanban board with drag and drop", look: "default", framework: "svelte", has: { "component-kit": "shadcn-svelte" } },
  { brief: "vue admin dashboard with charts", look: "corporate", framework: "vue", has: { "component-kit": "shadcn-vue", charts: "echarts" } },
  // A word that means something else here.
  { brief: "luxury watch store with smooth scroll", look: "luxury" },
  { brief: "apple pie recipe blog", look: "editorial", miss: "apple the fruit reads as the Apple look" },
  { brief: "crypto trading terminal with live prices", look: "technical" }, // a trading terminal is data-dense
  { brief: "not minimal at all, loud and playful kids quiz game", look: "playful" },
  { brief: "real estate agent listing site", look: "default", lacks: ["agent-ui", "text-effects"], miss: "'agent' reads as agent UI" },
  // A signal or need matched inside a longer word.
  { brief: "water intake tracker, count glasses per day", look: "default" },
  { brief: "article page for an online architecture magazine", look: "editorial" },
  { brief: "yoga studios booking app", look: "default" },
  { brief: "software licence manager", look: "default" },
  { brief: "client portal for a law firm", look: "corporate" },
  { brief: "timesheet app for contractors", look: "default", lacks: ["interaction"] },
  { brief: "portfolio for a photographer", look: "default", lacks: ["charts"] },
];

// The same job in other words. `top: null` means the registry has nothing for it and must say so.
// `sways` marks a pin that only holds while nothing is trending: see the test below the table.
const needs: { need: string; top: string | null; miss?: string; sways?: string }[] = [
  { need: "add a toast", top: "sonner", sways: "ties with react-hot-toast on fit" },
  { need: "sheet that slides up from the bottom", top: "vaul" },
  { need: "search menu opened with cmd k", top: "cmdk" },
  { need: "number that counts up", top: "number-flow" },
  { need: "swipeable image gallery", top: "embla-carousel" },
  { need: "blurred glass navbar", top: "glisse", sways: "liquid-glass-react is within a point" },
  { need: "accessible dropdown menu", top: "radix-ui" },
  { need: "line chart", top: "recharts", sways: "evilcharts is within a point" },
  { need: "smooth scrolling", top: "lenis" },
  { need: "show a notification", top: "sonner", sways: "ties with react-hot-toast on fit" },
  { need: "copy to clipboard button", top: "torph", miss: "kits with a copy button part rank above torph" },
  { need: "rich text editor", top: "tiptap" },
  { need: "video player", top: null },
];

const expectMiss = (miss: string | undefined, check: () => void) =>
  miss ? assert.throws(check, `this now passes (was: ${miss}); delete its miss`) : check();

for (const r of briefs)
  test(`${r.miss ? "known miss" : "brief"}: ${r.brief}`, () =>
    expectMiss(r.miss, () => {
      const p = plan(libraries, aesthetics, r.brief);
      const got = Object.fromEntries(p.items.map((i) => [i.kind, i.pick?.lib.id]));
      assert.equal(p.lookGuessed ? "default" : (p.look.family ?? p.look.id), r.look);
      if (r.framework) assert.equal(p.framework, r.framework);
      for (const [kind, id] of Object.entries(r.has ?? {})) assert.equal(got[kind], id, kind);
      for (const kind of r.lacks ?? []) assert.ok(!(kind in got), `${kind} is not needed`);
    }));

for (const r of needs)
  test(`${r.miss ? "known miss" : "need"}: ${r.need}`, () => expectMiss(r.miss, () => assert.equal(top(r.need) ?? null, r.top)));

// These tests run without stats. The live server adds up to +1.5 to a library that is trending, so a pin is only
// true there if it survives every rival trending at once. A row that does not carries `sways`.
for (const { need, top: id, miss, sways } of needs)
  if (id && !miss)
    test(`${sways ? "known sway" : "holds while rivals trend"}: ${need}`, () =>
      expectMiss(sways, () => assert.equal(pick(libraries.map((l) => (l.id === id ? l : { ...l, stats: { starsWeek: 600 } })), need)[0]?.lib.id, id)));

// Which libraries go with which look. Briefs that only imply a look through the product must read as it, and every
// kind the look curates must come from its own picks: a new library must not take a look's slot by keyword luck.
const looks: { look: AestheticId; brief: string; miss?: string }[] = [
  { look: "corporate", brief: "invoicing tool settings page" }, // invoicing reads as fintech
  { look: "minimal", brief: "pricing page, clean and quiet" },
  { look: "apple", brief: "habit tracker that feels like iOS" },
  { look: "apple", brief: "native-feel notes app", miss: "'notes app' names the document style, which ties with 'native feel' and wins as a style" },
  { look: "glass", brief: "music player with frosted glass panels" },
  { look: "glass", brief: "visionOS style weather app" },
  { look: "playful", brief: "kids spelling game, playful" },
  { look: "playful", brief: "fun colourful quiz app for teens" },
  { look: "brutalist", brief: "brutalist portfolio for a type designer" },
  { look: "brutalist", brief: "raw zine-style event site" },
  { look: "editorial", brief: "longform blog for an architect" },
  { look: "retro", brief: "pixel art game leaderboard" },
  { look: "retro", brief: "terminal-style personal site" },
  { look: "neon", brief: "cyberpunk racing game landing page" },
  { look: "neon", brief: "neon crypto wallet", miss: "the look's kits are all effects kits, so the base falls to shadcn-ui" },
  { look: "corporate", brief: "admin dashboard with tables and charts" },
  { look: "corporate", brief: "internal CRM for sales" },
  { look: "technical", brief: "docs site for an open source CLI" },
  { look: "technical", brief: "landing page for an email API, like Resend" },
  { look: "luxury", brief: "luxury watch boutique product page" },
  { look: "luxury", brief: "high-end hotel booking site" },
  { look: "organic", brief: "meditation app, calm and warm" },
  { look: "organic", brief: "wellness journal with soft colours" },
];

for (const r of looks)
  test(`${r.miss ? "known miss" : "look"}: ${r.brief}`, () =>
    expectMiss(r.miss, () => {
      const p = plan(libraries, aesthetics, r.brief);
      assert.equal(p.look.family ?? p.look.id, r.look);
      const own = p.look.picks;
      // The base kit's own pairing replaces a look pick that shuns the kit (Lucide, not Phosphor, under shadcn/ui).
      assert.deepEqual(p.items.filter((i) => i.pick && own[i.kind]?.length && !own[i.kind]!.includes(i.pick.lib.id) && !i.pick.why.startsWith("pairs with")).map((i) => `${i.kind}: ${i.pick!.lib.id}`), []);
    }));

// Every pick for every row above, as it is today. A new library or a scoring change that moves one fails here;
// `pnpm test:update` rewrites the file and the diff is the list of picks that moved, for the PR.
test("picks only move on purpose", (t) => {
  t.assert.snapshot([
    ...[...briefs, ...looks].map(({ brief }) => {
      const p = plan(libraries, aesthetics, brief);
      return `${brief} => ${p.lookGuessed ? "default" : p.look.id}, ${p.framework} | ${p.items.map((i) => `${i.kind}:${i.pick?.lib.id ?? "none"}`).join(" ")}`;
    }),
    ...needs.map(({ need }) => `${need} => ${pick(libraries, need).map((s) => s.lib.id).join(", ") || "none"}`),
  ]);
});
