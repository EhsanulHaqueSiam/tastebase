import assert from "node:assert/strict";
import { test } from "node:test";
import type { Library } from "./registry/schema.ts";
import { refreshStats } from "./trending.ts";

const lib = { id: "x", repo: "https://github.com/acme/x", npm: "x" } as Library;
// GitHub returns stars; npm bulk (a,b) returns a map, a single package returns { downloads }.
const fake = (stars: number) => async (url: string) => {
  if (url.includes("github")) return new Response(JSON.stringify({ stargazers_count: stars }));
  const names = url.split("/").pop()!.split(",");
  return new Response(JSON.stringify(names.length > 1 ? Object.fromEntries(names.map((n) => [n, { downloads: 500 }])) : { downloads: 500 }));
};

test("first run records stars without inventing a weekly gain", async () => {
  const s = await refreshStats([lib], {}, { fetch: fake(1000) });
  assert.deepEqual({ ...s.x, updatedAt: undefined }, { stars: 1000, starsWeek: 0, downloadsWeek: 500, updatedAt: undefined });
});

test("next day adds the gain on top of the decayed weekly figure", async () => {
  const s = await refreshStats([lib], { x: { stars: 1000, starsWeek: 70, updatedAt: "2000-01-01" } }, { fetch: fake(1030) });
  assert.equal(s.x?.starsWeek, 90); // 70 * 6/7 + 30
});

test("a failed fetch keeps the last known numbers", async () => {
  const s = await refreshStats([lib], { x: { stars: 9, downloadsWeek: 3, updatedAt: "2000-01-01" } }, { fetch: async () => new Response("", { status: 500 }) });
  assert.equal(s.x?.stars, 9);
  assert.equal(s.x?.downloadsWeek, 3);
});

test("batch refreshes only the stalest libraries and keeps the rest", async () => {
  const libs = ["a", "b", "c"].map((id) => ({ id, npm: id }) as Library);
  const prev = { a: { downloadsWeek: 1, updatedAt: "2000-01-03" }, b: { downloadsWeek: 1, updatedAt: "2000-01-01" }, c: { downloadsWeek: 1, updatedAt: "2000-01-02" } };
  const s = await refreshStats(libs, prev, { fetch: fake(0), batch: 2 });
  assert.deepEqual([s.a?.downloadsWeek, s.b?.downloadsWeek, s.c?.downloadsWeek], [1, 500, 500]);
});

test("several refreshes in one day keep adding gains without decaying twice", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const s = await refreshStats([lib], { x: { stars: 1000, starsWeek: 70, updatedAt: today } }, { fetch: fake(1010) });
  assert.equal(s.x?.starsWeek, 80);
});

test("features of a larger package get no stats of their own", async () => {
  const s = await refreshStats([lib, { ...lib, id: "y", partOf: "x" }], {}, { fetch: fake(5) });
  assert.deepEqual(Object.keys(s), ["x"]);
});

test("unscoped packages share one bulk npm request, scoped ones get their own", async () => {
  const urls: string[] = [];
  const libs = [{ id: "a", npm: "a" }, { id: "b", npm: "b" }, { id: "c", npm: "@s/c" }] as Library[];
  const s = await refreshStats(libs, {}, { fetch: async (u) => (urls.push(u), fake(0)(u)) });
  assert.deepEqual(urls.sort(), ["https://api.npmjs.org/downloads/point/last-week/@s/c", "https://api.npmjs.org/downloads/point/last-week/a,b"]);
  assert.deepEqual([s.a?.downloadsWeek, s.b?.downloadsWeek, s.c?.downloadsWeek], [500, 500, 500]);
});
