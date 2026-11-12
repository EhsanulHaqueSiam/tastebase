import assert from "node:assert/strict";
import { test } from "node:test";
import { groupByLook, islands, lookAffinity, partsMatrix, paywalled } from "./atlas.ts";
import { aesthetics, libraries } from "./registry/index.ts";
import { kinds } from "./registry/schema.ts";

const aff = lookAffinity(libraries);
const views = [libraries, ...kinds.map((k) => libraries.filter((l) => l.kind === k))];

test("every library lands in exactly one group, and best free never has paywalled parts", () => {
  for (const libs of views) {
    const groups = groupByLook(libs, aesthetics);
    assert.deepEqual(groups.flatMap((g) => g.libs.map((l) => l.id)).sort(), libs.map((l) => l.id).sort());
    for (const g of groups) if (g.bestFree) assert.ok(!paywalled(g.bestFree) && g.libs.includes(g.bestFree), g.key);
  }
});

test("islands never overlap, in every category and on the all-libraries map", () => {
  for (const libs of views) {
    const { islands: boxes } = islands(groupByLook(libs, aesthetics), aff);
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${libs[0]?.kind}: ${a.key} overlaps ${b.key}`);
  }
});

test("parts matrix lines up renamed components, marks paid-only ones and gives every kit a column", () => {
  const [a, b, c, d, e, f] = libraries;
  const libs = [
    { ...a!, parts: { free: ["Dialog", "Dropdown Menu", "Toast", "Tabs"] } },
    { ...b!, parts: { free: ["Modal", "Menu", "Tabs"], paid: ["Sonner"] } },
    { ...c!, parts: undefined },
    { ...d!, parts: { free: ["Dialog", "Tabs"] } },
    { ...e!, parts: { free: ["Marquee", "Globe"] } },
    { ...f!, parts: { free: ["Marquee", "Globe", "PDF Viewer"] } },
  ];
  const m = partsMatrix(libs, 6)!;
  assert.deepEqual(m.columns, ["Dialog", "Tabs", "Globe", "Marquee", "Menu", "Toast"]);
  assert.deepEqual(m.rows.find((r) => r.lib.id === b!.id)!.cells, ["free", "free", undefined, undefined, "free", "paid"]);
  assert.equal(m.rows.length, 5);
  // With four columns the effects kits still get Globe, ahead of the more common Toast.
  assert.deepEqual(partsMatrix(libs, 4)!.columns, ["Dialog", "Tabs", "Globe", "Menu"]);
  assert.equal(partsMatrix([a!, b!].map((l) => ({ ...l, parts: { free: ["Dialog", "Tabs"] } }))), undefined, "two libraries are too few to compare");
});
