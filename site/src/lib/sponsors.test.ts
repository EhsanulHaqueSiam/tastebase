import assert from "node:assert/strict";
import { test } from "node:test";
import { liveSponsors, withSponsors, type Sponsor } from "./sponsors.ts";

const s = (id: string, extra: Partial<Sponsor> = {}): Sponsor => ({ id, name: id, description: "", image: "", url: "https://x.dev", priority: 0, starts: "2026-11-01", ends: "2026-12-01", active: true, ...extra });

test("only active sponsors inside their dates run, best first, and homepage-only ones stay off grids", () => {
  const now = Date.parse("2026-11-21");
  const list = [s("a"), s("b", { priority: 5 }), s("old", { ends: "2026-11-10" }), s("off", { active: false }), s("home", { homepageOnly: true })];
  assert.deepEqual(liveSponsors(list, now).map((x) => x.id), ["b", "a"]);
  assert.deepEqual(liveSponsors(list, now, "home").map((x) => x.id), ["b", "a", "home"]);
});

test("a sponsor leads the grid and follows every 8th card, rotating", () => {
  const items = Array.from({ length: 17 }, (_, i) => ({ id: `i${i}` }));
  const slots = withSponsors(items, [s("a"), s("b")]);
  const ads = slots.flatMap((x, i) => ("sponsor" in x ? [[i, x.sponsor.id]] : []));
  assert.deepEqual(ads, [[0, "a"], [9, "b"], [18, "a"]]);
  assert.equal(withSponsors(items, []).length, 17);
  assert.equal(withSponsors([], [s("a")]).length, 0);
});
