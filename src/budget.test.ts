// Token budget for what agents read. tastebase exists to save agents tokens, so tool schemas and typical
// answers must stay small. Raising a budget is a deliberate decision: say why in the PR.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { formatLibrary } from "./format.ts";
import { createServer, INSTRUCTIONS, type Taste } from "./mcp.ts";
import { aesthetics, libraries } from "./registry/index.ts";
import { agentResourceKinds, resources } from "./registry/resources.ts";

const tokens = (s: string) => Math.ceil(s.length / 4); // ~4 chars per token for English and code
const worst = (sizes: (readonly [string, number])[]) => sizes.reduce((m, g) => (g[1] > m[1] ? g : m));

// Plans are measured at their largest: briefs that ask for many kinds, and those under every look, since a look's rules
// are most of a plan and some looks are much wordier than others.
const BRIEFS = [
  "dev-tool landing page like Resend with a shader hero, charts and a command menu",
  "glassmorphism dashboard",
  "claymorphism landing page for a kids app with progress, confetti and toasts",
  "glassmorphism weather app with charts, bottom sheet and toasts",
  "iOS-feel habit tracker with a bottom sheet, animated stats and a command menu",
  "AI chat app like Claude with tool calls, charts and a data table",
  "Expo habit tracker with animated stats and a bottom sheet",
];
const EVERY_LOOK = [
  "landing page with charts, toasts and a command menu",
  "dashboard with charts, data table, toasts and command palette",
  "AI chat app with charts, a data table, toasts and a bottom sheet",
  "landing page with animations, a typewriter headline, confetti, a bottom sheet and a 3d hero",
];

const BUDGET = {
  // sent with every session that connects, whether or not it calls a tool; 25 of it tells agents their skill is stale.
  // Raised from 325: the line that sends a rejected library or part to taste (37). Shorter, agents wrote a memory note
  // or only promised in chat (evals rejection-saves-taste, off-look-is-not-a-dislike), so the next project forgot it.
  instructions: 365,
  // every tool definition together, loaded when an agent first reaches for tastebase. Raised from 700: get's
  // _meta.ui (about 12) points hosts that render MCP Apps at the live library preview. Raised from 715: the get id
  // list names illustrations, a resource category for spot art, and agent tools by its own name (3).
  // Raised from 720: the taste tool (140), which keeps a user's hides, likes and off-look marks for later answers.
  schemas: 865,
  // raised from 800: a site type's build line (3D, motion-led, media-led) adds up to 115; the rules every look shares
  // (brief first, never broken) add 60; the line that says to install the picks first adds 15. Raised from 1010: each
  // specialist pick carries its usage, about 100 tokens each and 630 for this worst case of six, since builders that
  // saw only an install hand-wrote the part; one `get` per pick would cost more. Each slot also says why it is there;
  // the line that says to build with every pick adds 20, and the desktop-width rule 25. The base kit's parts for the
  // page, the default slots' reasons and the "done when" line add 90; answering why builders skipped installs, 15.
  // Raised from 1820: the icon pick shows how to set size and stroke once (35), since builders sized each icon apart.
  plan: 1860,
  pick: 250,
  // raised from 550 for the cost line and parts list (capped); saves a docs fetch per library. Raised from 650 for the
  // library's official MCP server, one setup line (about 20), which saves a docs lookup to connect it.
  get: 670,
};

async function connect(taste?: Taste) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(libraries, aesthetics, "test", undefined, taste).connect(a);
  const client = new Client({ name: "budget", version: "0" });
  await client.connect(b);
  const text = async (name: string, args: Record<string, unknown>) =>
    ((await client.callTool({ name, arguments: args })).content as { text: string }[])[0]!.text;
  return { client, text };
}

test("tool schemas and typical answers stay within the token budget", async () => {
  const { client, text } = await connect();
  // Every id an agent is told it can `get`: each library, look and resource category, plus the look and MCP server lists.
  const ids = [...libraries.map((l) => l.id), ...aesthetics.map((a) => a.id), ...agentResourceKinds, "looks", "integrations"];
  const gets = await Promise.all(ids.map(async (id) => [id, tokens(await text("get", { id }))] as const));
  const [getId, most] = worst(gets);
  const plans = await Promise.all([
    ...BRIEFS.map(async (brief) => [brief, tokens(await text("plan", { brief }))] as const),
    ...EVERY_LOOK.flatMap((brief) => aesthetics.map(async (a) => [`${brief} (look ${a.id})`, tokens(await text("plan", { brief, look: a.id }))] as const)),
  ]);
  // A saved look and framework add a few words to the look and framework lines of every plan that names neither.
  const saved = await connect({ hide: new Set(), like: new Set(), look: "game-ui", framework: "react-native" });
  plans.push(...(await Promise.all(BRIEFS.map(async (brief) => [`${brief} (saved look)`, tokens(await saved.text("plan", { brief }))] as const))));
  await saved.client.close();
  const [planBrief, planMost] = worst(plans);
  const used = {
    instructions: tokens(INSTRUCTIONS),
    schemas: tokens(JSON.stringify((await client.listTools()).tools)),
    plan: planMost,
    pick: tokens(await text("pick", { need: "copy button that confirms" })),
    get: most,
  };
  await client.close();
  for (const k of Object.keys(BUDGET) as (keyof typeof BUDGET)[])
    assert.ok(used[k] <= BUDGET[k], `${k}: ${used[k]} tokens > budget ${BUDGET[k]}${k === "get" ? ` (get ${getId})` : k === "plan" ? ` (${planBrief})` : ""}`);
});

test("an unknown look id is answered with the closest ids", async () => {
  const { client, text } = await connect();
  assert.match(await text("plan", { brief: "habit tracker", look: "frosted-ios" }), /^Unknown look .*\bglass\b/);
  assert.match(await text("pick", { need: "toast", look: "minimalist" }), /^Unknown look .*\bminimal\b/);
  await client.close();
});

// Every library, not a sample: a new entry with a long note or parts list must not push its `get` past the budget.
test("every library's get answer stays within the budget", () => {
  const over = libraries.map((l) => [l.id, tokens(formatLibrary(l))] as const).filter(([, n]) => n > BUDGET.get);
  assert.deepEqual(over.map(([id, n]) => `${id}: ${n}`), [], "over the get budget");
});

// An agent key's taste (site/src/pages/mcp.ts): what its owner hid is never offered, by any tool.
test("a hidden library or resource never reaches that user's agent", async () => {
  const icons = resources.find((r) => r.kind === "icons")!;
  const { text } = await connect({ hide: new Set(["sonner", icons.id]), like: new Set() });
  assert.doesNotMatch(await text("pick", { need: "toast" }), /\bsonner\b/);
  assert.doesNotMatch(await text("plan", { brief: "dashboard with toasts" }), /\bsonner\b/);
  assert.match(await text("get", { id: "sonner" }), /^Unknown id/);
  assert.ok(!(await text("get", { id: "icons" })).includes(icons.url));
  assert.match(await (await connect()).text("pick", { need: "toast" }), /\bsonner\b/);
  // Free text still names it (ding's alternatives); the answer says the user hid it.
  assert.match(await text("get", { id: "ding" }), /\nthe user hid sonner: never use it$/);
  // By display name too, and in a site type's picks; a library's features go with it (GSAP SplitText).
  const shadcnOff = await connect({ hide: new Set(["shadcn-ui", "gsap"]), like: new Set() });
  assert.match(await shadcnOff.text("get", { id: "spartan-ng" }), /\nthe user hid shadcn-ui: never use it$/);
  assert.match(await shadcnOff.text("get", { id: "motion-site" }), /\nthe user hid gsap, gsap-splittext: never use them$/);
  assert.match(await shadcnOff.text("get", { id: "gsap-splittext" }), /^Unknown id/);
});

test("a hidden part leaves its kit's answers; an off-look mark holds under its look only", async () => {
  const shadcn = "date picker, we use shadcn";
  const { text } = await connect({ hide: new Set(["shadcn-ui/date-picker"]), like: new Set(), offLook: new Map([["minimal", new Set(["sonner"])]]) });
  assert.doesNotMatch(await text("pick", { need: shadcn }), /Your kit ships it: shadcn-ui/);
  assert.match(await (await connect()).text("pick", { need: shadcn }), /Your kit ships it: shadcn-ui \(Date Picker\)/);
  assert.match(await text("get", { id: "shadcn-ui" }), /\nthe user hid shadcn-ui\/date-picker: never use it$/);
  assert.doesNotMatch(await text("pick", { need: "toast", look: "minimal" }), /^sonner:/m);
  assert.doesNotMatch(await text("pick", { need: "minimal dashboard toast" }), /^sonner:/m);
  assert.match(await text("pick", { need: "dashboard toast, not minimal" }), /^sonner:/m);
  assert.match(await text("get", { id: "minimal" }), /\nthe user marked sonner wrong for the minimal look: do not use it here$/);
  assert.match(await text("pick", { need: "toast", look: "apple" }), /^sonner:/m);
  assert.doesNotMatch(await text("plan", { brief: "dashboard with toasts", look: "minimal" }), /-> sonner:/);
  // A hidden part is no kit's answer for its job, nor in the kit's own install and example (Kokonut's is Hold Button).
  const parts = await connect({ hide: new Set(["coss-ui/chat", "kokonut-ui/hold-button"]), like: new Set() });
  assert.doesNotMatch(await parts.text("plan", { brief: "dashboard with Chat using coss-ui" }), /agent-ui -> coss-ui: the base kit ships it/);
  const kokonut = await parts.text("get", { id: "kokonut-ui" });
  assert.match(kokonut, /^install: npx shadcn@latest add @kokonutui\/<part>$/m);
  assert.doesNotMatch(kokonut.split("\nnote:")[0]!, /hold-button|HoldButton/);
  const button = await connect({ hide: new Set(["shadcn-ui/button"]), like: new Set() });
  assert.match(await button.text("get", { id: "shadcn-ui" }), /^install: .*add card input$/m);
  const park = await connect({ hide: new Set(["park-ui/button"]), like: new Set() });
  assert.match(await park.text("get", { id: "park-ui" }), /^install: npx @park-ui\/cli add <part>$/m);
});

test("a saved look and framework stand in only when the call and the brief name none", async () => {
  const { text } = await connect({ hide: new Set(), like: new Set(), look: "neo-brutalism", framework: "vue" });
  assert.match(await text("plan", { brief: "habit tracker" }), /^look: Neo-brutalism \(neo-brutalism.*the user's saved look[^\n]*\nframework: vue \(the user's default\)/);
  assert.match(await text("plan", { brief: "glassmorphism dashboard in svelte" }), /^look: Glassmorphism \(glassmorphism[^\n]*\nframework: svelte\n/);
  assert.match(await text("plan", { brief: "habit tracker", look: "apple", framework: "react" }), /^look: [^\n]*\(apple\)\nframework: react\n/);
  // Pick ranks by the look the job names, else the saved one; Minimal's toast leads either way.
  const plain = await connect({ hide: new Set(), like: new Set(), look: "minimal" });
  assert.match(await plain.text("pick", { need: "toast" }), /^look: minimal \(the user's saved look[^\n]*\nsonner:/);
  assert.match(await (await connect()).text("pick", { need: "minimal design toast" }), /^sonner:/);
  // The brief rules a saved default out, or names a kit for another framework: the saved one steps aside.
  const glass = await connect({ hide: new Set(), like: new Set(), look: "glassmorphism", framework: "vue" });
  assert.doesNotMatch(await glass.text("plan", { brief: "pricing page, no glassmorphism, not vue" }), /^look: Glassmorphism|\nframework: vue/);
  assert.match(await glass.text("plan", { brief: "dashboard with a data table, we use mantine" }), /\nframework: react[^\n]*\n[\s\S]*mantine/);
  assert.match(await glass.text("pick", { need: "toast" }), /^look: glassmorphism \(the user's saved look/);
  assert.doesNotMatch(await glass.text("plan", { brief: "pricing page, without svelte or vue" }), /\nframework: vue/);
  assert.match(await glass.text("plan", { brief: "settings page, we use headless ui" }), /\nframework: vue \(the user's default\)/);
  assert.match(await glass.text("plan", { brief: "dashboard, we use chakra" }), /\nframework: react \(assumed/);
  assert.match(await glass.text("plan", { brief: "settings page, we use shadcn" }), /\nframework: vue \(the user's default\)[\s\S]*shadcn-vue/);
  const angular = await connect({ hide: new Set(), like: new Set(), framework: "angular" });
  assert.match(await angular.text("plan", { brief: "settings page, we use shadcn" }), /\nframework: react[^\n]*\n[\s\S]*-> shadcn-ui/);
});

test("taste saves only valid ids through the key's owner, and says so without a key", async () => {
  const saved: unknown[] = [];
  const { text } = await connect({ hide: new Set(), like: new Set(), save: async (...a) => void saved.push(a) });
  assert.match(await text("taste", { id: "kokonut-ui/pull-cord", action: "hide" }), /^Saved: kokonut-ui\/pull-cord is hidden/);
  assert.match(await text("taste", { id: "sonner", action: "off-look", look: "minimal" }), /^Saved: sonner is left out under minimal only/);
  assert.match(await text("taste", { id: "sonner", action: "off-look" }), /needs the look id/);
  assert.match(await text("taste", { id: "kokonut-ui/pull-chord", action: "hide" }), /Did you mean: kokonut-ui\/pull-cord/);
  assert.match(await text("taste", { id: "kokonut-ui/pull-cord", action: "like" }), /^Only a whole library/);
  assert.match(await text("taste", { id: "sonner", action: "undo" }), /^Saved: sonner is offered again/);
  const hidden = await connect({ hide: new Set(["vaul"]), like: new Set(), save: async () => {} });
  assert.match(await hidden.text("taste", { id: "vaul", action: "off-look", look: "minimal" }), /stays hidden under every look/);
  assert.deepEqual(saved, [["kokonut-ui/pull-cord", "hide", undefined], ["sonner", "off-look", "minimal"], ["sonner", "undo", undefined]]);
  const keyless = await connect();
  assert.match(await keyless.text("taste", { id: "sonner", action: "hide" }), /^Not saved: .*Leave sonner out for the rest of this chat/);
  assert.doesNotMatch(await keyless.text("taste", { id: "sonner", action: "like" }), /Leave/);
});
