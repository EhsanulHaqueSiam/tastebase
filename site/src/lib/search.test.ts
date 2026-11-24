import assert from "node:assert/strict";
import { test } from "node:test";
import { ranked, wordShare } from "./search.ts";

const groups = [
  { id: "kits", rows: [{ name: "Kobra", text: "Component kit with a Sonner toast, dialog and sheet" }, { name: "Motion", text: "Animation: springs, gestures, layout transitions, scroll-linked effects" }] },
  { id: "feedback", rows: [{ name: "Sonner", text: "Opinionated toast notifications for React: toasts that stack and swipe away" }] },
  { id: "reviewed", rows: [{ name: "Beautiful UI", text: "React components for AI chat and agent UIs" }] },
];
const names = (q: string) => ranked(groups, q).flatMap((g) => g.rows.map((r) => r.name));

test("a name match leads across groups, scattered letters drop out, and a typo in a name still finds it", () => {
  assert.deepEqual(names("beautiful ui"), ["Beautiful UI"]);
  assert.deepEqual(names("beutiful"), ["Beautiful UI"]);
  assert.deepEqual(names("sonner"), ["Sonner", "Kobra"]); // its group moves above the kits that only mention it
  assert.deepEqual(names("toast"), ["Kobra", "Sonner"]); // a tie keeps registry order
  assert.deepEqual(names("anim"), ["Motion"]); // the word being typed matches as a prefix
  assert.equal(ranked(groups, " "), groups);
  assert.deepEqual(ranked(groups.map((g) => ({ ...g, weight: g.id === "kits" ? 0.5 : 1 })), "toast").map((g) => g.id), ["feedback", "kits"]);
});

test("a sentence matches on its content words, enough of them", () => {
  assert.deepEqual(names("toast that stacks and swipes away"), ["Sonner"]);
  assert.deepEqual(names("chat ui for my ai agent"), ["Beautiful UI"]);
  assert.equal(wordShare("a date picker for my app", "Calendar and date picker"), 1);
  assert.equal(wordShare("nice date picker", "Calendar and date picker"), 2 / 3);
  assert.equal(wordShare("nice date picker", "Date formatting helpers"), 0); // one of three is not enough
  assert.equal(wordShare("for my app", "anything"), 0); // only stop words
});
