import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { pick, plan } from "../engine.ts";
import { aesthetics, libraries, siteTypes } from "./index.ts";
import { kinds, type Framework } from "./schema.ts";

const ids = new Set(libraries.map((l) => l.id));

test("library ids are unique", () => assert.equal(ids.size, libraries.length));

test("every cross-reference points at a real library", () => {
  const dangling: string[] = [];
  for (const l of libraries) for (const r of [...(l.pairsWith ?? []), ...(l.alternatives ?? [])]) if (!ids.has(r)) dangling.push(`${l.id} -> ${r}`);
  for (const a of [...aesthetics, ...siteTypes]) for (const r of Object.values(a.picks).flat()) if (!ids.has(r!)) dangling.push(`look ${a.id} -> ${r}`);
  assert.deepEqual(dangling, []);
});

test("every kind has at least one library", () => {
  const covered = new Set(libraries.flatMap((l) => [l.kind, ...(l.alsoCovers ?? [])]));
  assert.deepEqual(kinds.filter((k) => !covered.has(k)), []);
});

test("entries sharing a repo or npm package mark all but one with partOf, so stats are not double-counted", () => {
  const owners = new Map<string, string[]>();
  for (const l of libraries) if (!l.partOf) for (const k of [l.repo?.toLowerCase().replace(/\/$/, ""), l.npm && `npm:${l.npm}`]) if (k) owners.set(k, [...(owners.get(k) ?? []), l.id]);
  assert.deepEqual([...owners].filter(([, ids]) => ids.length > 1), []);
});

// A library that cannot be reached by the jobs it lists is dead weight, however good its entry reads. Every rival
// is made to trend, so a library that only wins on a tie fails here before it fails for a user. Reached means offered
// by pick, or by a plan as a pick or an alternative: a kit is a plan's base, not the answer to one job.
// shortcut: 91 of the jobs libraries list do not offer them yet; the ceiling only goes down, lower it as rows are fixed.
const STRANDED = 91;
test("every library is offered for the jobs it claims, even while its rivals trend", () => {
  const unreached: string[] = [];
  const stranded: string[] = [];
  for (const l of libraries.filter((x) => !x.partOf)) {
    const rivals = libraries.map((x) => (x.id === l.id ? x : { ...x, stats: { starsWeek: 600 } }));
    const framework = l.frameworks[0];
    const lost = l.useFor.filter((job) => {
      const offered = [...pick(rivals, job, { framework }), ...plan(rivals, aesthetics, job, { framework }).items.flatMap((i) => [i.pick, ...i.alternatives])];
      return !offered.some((s) => s?.lib.id === l.id);
    });
    if (lost.length === l.useFor.length) unreached.push(l.id);
    stranded.push(...lost.map((job) => `${l.id}: "${job}"`));
  }
  assert.deepEqual(unreached, [], "offered for none of its jobs");
  assert.ok(stranded.length <= STRANDED, `${stranded.length} jobs do not offer their library (ceiling ${STRANDED}):\n${stranded.join("\n")}`);
  assert.ok(stranded.length === STRANDED, `fewer jobs are stranded: lower STRANDED to ${stranded.length}`);
});

test("usage is written against the package the entry names", () => {
  // These install through their own CLI and are then imported from the project, so there is no package to name.
  const cli = ["shadcn-ui", "shadcn-vue", "shadcn-svelte", "boardui", "expokit", "spartan-ng", "transitions-dev"];
  assert.deepEqual(libraries.filter((l) => l.npm && !l.usage.includes(l.npm)).map((l) => l.id), cli);
});

// The site shows every library with a screenshot of how it looks and its icon; an entry without them looks broken.
test("every library has a screenshot and an icon for the site", () => {
  const missing = libraries.flatMap((l) => [`shots/${l.id}.webp`, `marks/${l.id}.png`].filter((f) => !existsSync(new URL(`../../site/public/${f}`, import.meta.url))));
  assert.deepEqual(missing, [], "run pnpm capture <id>");
});

test("per-framework installs only name frameworks the library supports", () => {
  const stray = libraries.flatMap((l) => Object.keys(l.installFor ?? {}).filter((f) => !l.frameworks.includes(f as Framework)).map((f) => `${l.id}: ${f}`));
  assert.deepEqual(stray, []);
});

test("look ids are unique across families and styles, and every style's family exists", () => {
  const lookIds = aesthetics.map((a) => a.id);
  assert.deepEqual(lookIds.filter((id, i) => lookIds.indexOf(id) !== i), []);
  const families = new Set(aesthetics.filter((a) => !a.family).map((a) => a.id));
  assert.deepEqual(aesthetics.filter((a) => a.family && !families.has(a.family)).map((a) => `${a.id} -> ${a.family}`), []);
});

test("every look links an https reference and has swatch colours", () => {
  const bare = aesthetics.filter((a) => !a.references.some((r) => r.url.startsWith("https://")) || !a.swatch.bg || !a.swatch.text);
  assert.deepEqual(bare.map((a) => a.id), []);
});
