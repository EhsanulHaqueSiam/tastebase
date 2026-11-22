import assert from "node:assert/strict";
import { test } from "node:test";
import { follow, type SurveyLook } from "./survey.ts";

const look = (id: string, picks: string[]): SurveyLook => ({ id, name: id, summary: "", swatch: { bg: "#000", surface: "#000", text: "#fff", accent: "#fff", radius: 0, font: "sans" }, picks });
const looks = [look("minimal", ["shadcn-ui", "base-ui", "motion", "sonner"]), look("glass", ["glisse", "base-ui", "paper-shaders"]), look("playful", ["kokonut", "motion", "canvas-confetti"])];

test("libraries follow the liked looks in turns, without repeats", () => {
  assert.deepEqual(follow(looks, ["minimal", "glass"], 5), ["shadcn-ui", "glisse", "base-ui", "motion", "paper-shaders"]);
  assert.deepEqual(follow(looks, ["playful"], 6), ["kokonut", "motion", "canvas-confetti"]);
});

test("nothing liked still offers libraries, from every look", () => {
  assert.deepEqual(follow(looks, [], 3), ["shadcn-ui", "glisse", "kokonut"]);
});
