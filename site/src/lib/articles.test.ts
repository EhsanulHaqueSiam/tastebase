import assert from "node:assert/strict";
import { test } from "node:test";
import { libraries } from "../../../src/registry/index.ts";
import { articleJsonLd, comparisons, jsonLd, roundups } from "./articles.ts";

test("articles only list real libraries, link real pages and never repeat a slug", () => {
  const ids = new Set(libraries.map((l) => l.id));
  const all = [...roundups, ...comparisons];
  const paths = new Set(all.map((a) => a.path));
  assert.equal(paths.size, all.length);
  for (const a of all) {
    assert.ok(a.libs.length >= 2 && a.libs.every((l) => ids.has(l.id)), a.slug);
    for (const r of a.related) assert.ok(paths.has(r.href), `${a.slug} links ${r.href}`);
    for (const row of a.rows) if (row.alternatives) assert.ok(paths.has(row.alternatives), row.alternatives);
  }
});

test("a free roundup lists no paid library, and JSON-LD cannot close its script tag", () => {
  for (const a of roundups.filter((r) => r.slug.startsWith("best-free-"))) assert.deepEqual(a.libs.filter((l) => l.paid).map((l) => l.id), [], a.slug);
  const a = { ...comparisons[0]!, faqs: [{ q: "x", a: "</script><script>alert(1)</script>" }] };
  assert.ok(!jsonLd(articleJsonLd(a)).includes("</script>"));
});
