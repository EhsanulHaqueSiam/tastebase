import assert from "node:assert/strict";
import { test } from "node:test";
import { pick, plan } from "./engine.ts";
import { aesthetics, libraries } from "./registry/index.ts";
import type { Framework } from "./registry/schema.ts";

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
