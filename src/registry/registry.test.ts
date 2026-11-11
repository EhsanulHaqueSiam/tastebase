import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { pick } from "../engine.ts";
import { aesthetics, libraries } from "./index.ts";
import { kinds } from "./schema.ts";

const ids = new Set(libraries.map((l) => l.id));

test("library ids are unique", () => assert.equal(ids.size, libraries.length));

test("every cross-reference points at a real library", () => {
  const dangling: string[] = [];
  for (const l of libraries) for (const r of [...(l.pairsWith ?? []), ...(l.alternatives ?? [])]) if (!ids.has(r)) dangling.push(`${l.id} -> ${r}`);
  for (const a of aesthetics) for (const r of Object.values(a.picks).flat()) if (!ids.has(r!)) dangling.push(`look ${a.id} -> ${r}`);
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
// is made to trend, so a library that only wins on a tie fails here before it fails for a user.
test("every library wins the first job it claims and is offered for the rest, even while its rivals trend", () => {
  const lost: string[] = [];
  for (const l of libraries.filter((x) => !x.partOf)) {
    const rivals = libraries.map((x) => (x.id === l.id ? x : { ...x, stats: { starsWeek: 600 } }));
    l.useFor.forEach((job, i) => {
      const got = pick(rivals, job, { framework: l.frameworks[0] }).map((s) => s.lib.id);
      if (i === 0 ? got[0] !== l.id : !got.includes(l.id)) lost.push(`${l.id}: "${job}" -> ${got.join(", ")}`);
    });
  }
  assert.deepEqual(lost, []);
});

test("usage is written against the package the entry names", () => {
  // These install through their own CLI and are then imported from the project, so there is no package to name.
  const cli = ["shadcn-ui", "shadcn-vue", "shadcn-svelte", "boardui", "expokit", "transitions-dev"];
  assert.deepEqual(libraries.filter((l) => l.npm && !l.usage.includes(l.npm)).map((l) => l.id), cli);
});

// The site shows every library with a screenshot of how it looks and its icon; an entry without them looks broken.
test("every library has a screenshot and an icon for the site", () => {
  const missing = libraries.flatMap((l) => [`shots/${l.id}.webp`, `marks/${l.id}.png`].filter((f) => !existsSync(new URL(`../../site/public/${f}`, import.meta.url))));
  assert.deepEqual(missing, [], "run pnpm capture <id>");
});
