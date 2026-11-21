import assert from "node:assert/strict";
import { test } from "node:test";
import type { Library } from "./registry/schema.ts";
import { scoreX } from "./xtrends.ts";

const lib = (id: string, name: string, extra: Partial<Library> = {}) => ({ id, name, url: `https://${id}.dev`, ...extra }) as Library;
const libs = [lib("vaul", "Vaul", { repo: "https://github.com/emilkowalski/vaul" }), lib("motion", "Motion", { npm: "motion" }), lib("glisse", "Glisse")];
const now = new Date("2026-11-21T00:00:00Z");
const post = (url: string, text: string, likes: number, created = "2026-11-20T00:00:00Z") => ({ url, text, likes, created });

test("posts are credited to the libraries they name, by name, site or repo, within the week", () => {
  const t = scoreX(
    [
      post("a", "Shipping a drawer with Vaul today", 100),
      post("b", "github.com/emilkowalski/vaul just hit 10k stars", 40),
      post("c", "Liquid glass in the browser: Glisse", 30),
      post("d", "Vaul was great last month", 999, "2026-11-01T00:00:00Z"), // older than a week
      post("a", "Shipping a drawer with Vaul today", 100), // the same post twice counts once
    ],
    libs,
    now,
  );
  assert.deepEqual(t.libs.vaul, { posts: 2, likes: 140, top: "a" });
  assert.deepEqual(t.libs.glisse, { posts: 1, likes: 30, top: "c" });
});

test("a library whose name is a common word needs its site, repo or package, not the word", () => {
  const t = scoreX([post("e", "Love the motion on this page", 50), post("f", "npm i motion and done", 20)], libs, now);
  assert.deepEqual(t.libs.motion, { posts: 1, likes: 20, top: "f" });
});
