/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createFolder, deleteFolder, loadAccount, mergeSaved, readFolder, setSaved, updateFolder } from "./auth-data.ts";
import { memoryD1 } from "./d1-shim.test-util.ts";

function setup() {
  const d1 = memoryD1();
  d1.exec(readFileSync(new URL("../../../migrations/0001_accounts.sql", import.meta.url), "utf8"));
  for (const u of ["ana", "bo"]) d1.exec(`insert into user values ('${u}', '${u}', '${u}@x.dev', 1, null, 0, 0)`);
  return d1 as unknown as D1Database;
}

test("first sign-in merges the browser's hearts into the account without duplicates, in browser order", async () => {
  const db = setup();
  await setSaved(db, "ana", "vaul", true);
  await mergeSaved(db, "ana", ["sonner", "vaul", "motion"]);
  assert.deepEqual((await loadAccount(db, "ana")).saved, ["vaul", "sonner", "motion"]);
  await setSaved(db, "ana", "vaul", false);
  assert.deepEqual((await loadAccount(db, "ana")).saved, ["sonner", "motion"]);
  assert.deepEqual((await loadAccount(db, "bo")).saved, []);
});

test("a private folder is readable and editable only by its owner; a public one is readable by anyone", async () => {
  const db = setup();
  const f = (await createFolder(db, "ana", "Sheets", "vaul"))!;
  assert.equal(await readFolder(db, f.id, "bo"), null);
  assert.equal(await readFolder(db, f.id, undefined), null);
  assert.equal((await readFolder(db, f.id, "ana"))?.mine, true);

  assert.equal(await updateFolder(db, "bo", f.id, { public: true, add: "sonner", name: "mine now" }), false);
  assert.equal(await deleteFolder(db, "bo", f.id), false);
  assert.equal(await readFolder(db, f.id, "bo"), null);

  assert.equal(await updateFolder(db, "ana", f.id, { public: true, add: "sonner" }), true);
  const shared = await readFolder(db, f.id, "bo");
  assert.deepEqual(shared && { name: shared.name, libs: shared.libs, mine: shared.mine, owner: shared.owner.name }, { name: "Sheets", libs: ["vaul", "sonner"], mine: false, owner: "ana" });

  assert.equal(await deleteFolder(db, "ana", f.id), true);
  assert.equal(await readFolder(db, f.id, "ana"), null);
  assert.deepEqual((await loadAccount(db, "ana")).folders, []);
});
