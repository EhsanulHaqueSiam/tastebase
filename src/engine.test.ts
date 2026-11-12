import assert from "node:assert/strict";
import { test } from "node:test";
import { pick, plan } from "./engine.ts";
import { aesthetics, libraries } from "./registry/index.ts";
import type { AestheticId, Framework, Kind } from "./registry/schema.ts";

const picks = (brief: string, framework?: Framework) =>
  Object.fromEntries(plan(libraries, aesthetics, brief, { framework }).items.map((i) => [i.kind, i.pick?.lib.id]));
const top = (need: string) => pick(libraries, need)[0]?.lib.id;

test("a look named in the brief drives the stack", () => {
  const p = picks("iOS-feel habit tracker with a bottom sheet and animated stats");
  assert.equal(p["component-kit"], "shadcn-ui");
  assert.equal(p.interaction, "vaul");
  assert.equal(p["text-effects"], "number-flow");
  assert.equal(p.glass, "glisse");
});

test("effects kits never become the base layer", () => {
  assert.equal(picks("dev-tool landing page like Resend with a shader hero")["component-kit"], "shadcn-ui");
});

test("raw looks build on primitives, and the framework is read from the brief", () => {
  assert.equal(picks("luxury fashion store, editorial, smooth scroll").primitives, "base-ui");
  const vue = plan(libraries, aesthetics, "nuxt marketing site with liquid glass cards");
  assert.equal(vue.framework, "vue");
  assert.ok(vue.items.every((i) => !i.pick || i.pick.lib.frameworks.includes("vue")));
});

test("single jobs land on the specialist", () => {
  assert.equal(top("copy button that confirms"), "torph");
  assert.equal(top("animated price"), "number-flow");
  assert.equal(top("toast after save"), "sonner");
  assert.equal(top("hero shader background"), "paper-shaders");
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

// What people type, and what they must get. `miss` marks a row the engine gets wrong today; the test then asserts
// it still fails, so a fix (or a lucky new library) shows up as "delete the miss".
type Brief = { brief: string; look: AestheticId | "default"; framework?: Framework; has?: Partial<Record<Kind, string>>; lacks?: Kind[]; miss?: string };
const briefs: Brief[] = [
  { brief: "like Linear but for invoices", look: "minimal" },
  { brief: "clean quiet settings page", look: "minimal" },
  { brief: "I want it to feel like iOS", look: "apple", has: { glass: "glisse" } },
  { brief: "admin dashboard with tables and charts", look: "corporate", has: { "component-kit": "mantine", charts: "recharts" } },
  { brief: "internal CRM for sales team", look: "corporate" },
  { brief: "docs site for an open source CLI", look: "technical" },
  { brief: "landing page for my API product, like Resend", look: "technical", has: { background: "paper-shaders" } },
  { brief: "magazine style longform article page", look: "editorial", has: { primitives: "base-ui", scroll: "lenis" } },
  { brief: "pixel art game leaderboard", look: "retro", has: { icons: "pixelarticons" } },
  { brief: "wedding invitation site, elegant", look: "luxury" },
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
  { brief: "luxury watch store with smooth scroll", look: "luxury", miss: "'smooth' is an apple signal and ties with luxury" },
  { brief: "apple pie recipe blog", look: "editorial", miss: "apple the fruit reads as the Apple look" },
  { brief: "crypto trading terminal with live prices", look: "neon", miss: "'terminal' reads as retro and ties with crypto" },
  { brief: "not minimal at all, loud and playful kids quiz game", look: "playful", miss: "negation is ignored" },
  { brief: "real estate agent listing site", look: "default", lacks: ["agent-ui", "text-effects"], miss: "'agent' reads as agent UI, 'stat' matches inside 'estate'" },
  // A signal or need matched inside a longer word.
  { brief: "water intake tracker, count glasses per day", look: "default", miss: "'glass' matches inside 'glasses'" },
  { brief: "article page for an online architecture magazine", look: "editorial", miss: "'zine' matches inside 'magazine' and ties with it, so it reads as brutalist" },
  { brief: "yoga studios booking app", look: "default", miss: "'ios' matches inside 'studios'" },
  { brief: "software licence manager", look: "default", miss: "'soft' matches inside 'software'" },
  { brief: "client portal for a law firm", look: "default", miss: "'cli' matches inside 'client'" },
  { brief: "timesheet app for contractors", look: "default", lacks: ["interaction"], miss: "'sheet' matches inside 'timesheet'" },
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
  { need: "show a notification", top: "sonner", miss: "mantine's useFor mentions notifications more often than sonner's" },
  { need: "copy to clipboard button", top: "torph", miss: "only 'copy button that confirms' reaches torph" },
  { need: "rich text editor", top: null, miss: "no score floor: unrelated libraries match on one word" },
  { need: "video player", top: null, miss: "no score floor: unrelated libraries match on one word" },
];

const expectMiss = (miss: string | undefined, check: () => void) =>
  miss ? assert.throws(check, `this now passes (was: ${miss}); delete its miss`) : check();

for (const r of briefs)
  test(`${r.miss ? "known miss" : "brief"}: ${r.brief}`, () =>
    expectMiss(r.miss, () => {
      const p = plan(libraries, aesthetics, r.brief);
      const got = Object.fromEntries(p.items.map((i) => [i.kind, i.pick?.lib.id]));
      assert.equal(p.lookGuessed ? "default" : p.look.id, r.look);
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
  { look: "minimal", brief: "invoicing tool settings page" },
  { look: "minimal", brief: "pricing page, clean and quiet" },
  { look: "apple", brief: "habit tracker that feels like iOS" },
  { look: "apple", brief: "native-feel notes app", miss: "'native feel' is a signal; 'native-feel' is not" },
  { look: "glass", brief: "music player with frosted glass panels", miss: "canvas-ui beats paper-shaders for the background" },
  { look: "glass", brief: "visionOS style weather app", miss: "tabler-icons beats lucide" },
  { look: "playful", brief: "kids spelling game, playful", miss: "the look's kits are all effects kits, which never fill the base slot, so 8bitcn (a pixel kit) does" },
  { look: "playful", brief: "fun colourful quiz app for teens", miss: "the look's kits are all effects kits, so the base falls to shadcn-ui" },
  { look: "brutalist", brief: "brutalist portfolio for a type designer" },
  { look: "brutalist", brief: "raw zine-style event site", miss: "tabler-icons beats iconoir" },
  { look: "editorial", brief: "longform blog for an architect" },
  { look: "retro", brief: "pixel art game leaderboard" },
  { look: "retro", brief: "terminal-style personal site", miss: "tabler-icons beats pixelarticons" },
  { look: "neon", brief: "cyberpunk racing game landing page", miss: "the look's kits are all effects kits, so the base falls to 8bitcn" },
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
      assert.equal(p.look.id, r.look);
      const own = p.look.picks;
      assert.deepEqual(p.items.filter((i) => i.pick && own[i.kind]?.length && !own[i.kind]!.includes(i.pick.lib.id)).map((i) => `${i.kind}: ${i.pick!.lib.id}`), []);
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
