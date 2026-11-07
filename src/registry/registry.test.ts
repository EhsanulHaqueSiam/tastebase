import assert from "node:assert/strict";
import { test } from "node:test";
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
