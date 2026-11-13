// The hosted MCP tells agents to update their copy of the skill when its version differs from SKILL_VERSION.
// The version is a hash of the skill, so an edit cannot ship without a new one.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SKILL_VERSION } from "./mcp.ts";

test("SKILL.md and SKILL_VERSION carry the skill's current hash", () => {
  const skill = readFileSync(new URL("../skills/tastebase/SKILL.md", import.meta.url), "utf8");
  const hash = createHash("sha256").update(skill.replace(/Skill version [0-9a-f]+\./, "Skill version .")).digest("hex").slice(0, 7);
  const fix = `The skill changed: set "Skill version ${hash}." in SKILL.md and SKILL_VERSION = "${hash}" in src/mcp.ts.`;
  assert.match(skill, new RegExp(`Skill version ${hash}\\.`), fix);
  assert.equal(SKILL_VERSION, hash, fix);
});
