/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { approveLogin, claimLogin, createFolder, deleteAgentKey, deleteKey, keyOwner, deleteFolder, isAdmin, listPicks, loadAccount, makeAgentKey, mergeSaved, offLookCounts, readFolder, saveTaste, setHidden, setOffLook, setPick, setPrefs, setSaved, tasteForKey, tasteForUser, updateFolder } from "./auth-data.ts";
import { memoryD1 } from "./d1-shim.test-util.ts";

function setup() {
  const d1 = memoryD1();
  for (const m of ["0001_accounts", "0002_taste", "0003_editor_picks", "0004_off_look", "0005_pref", "0006_agent_keys"]) d1.exec(readFileSync(new URL(`../../../migrations/${m}.sql`, import.meta.url), "utf8"));
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

test("an agent key reads its owner's hidden and hearted items; each key signs out on its own", async () => {
  const db = setup();
  await setSaved(db, "ana", "sonner", true);
  await setHidden(db, "ana", "vaul", true);
  await setHidden(db, "bo", "motion", true);
  const laptop = (await makeAgentKey(db, "ana", "laptop"))!;
  const taste = await tasteForKey(db, laptop.key);
  assert.deepEqual(taste && { hide: [...taste.hide], like: [...taste.like] }, { hide: ["vaul"], like: ["sonner"] });

  const desk = (await makeAgentKey(db, "ana", "desk"))!;
  assert.deepEqual((await loadAccount(db, "ana")).keys.map((k) => [k.name, k.last4]), [["laptop", laptop.key.slice(-4)], ["desk", desk.key.slice(-4)]]);
  await deleteAgentKey(db, "bo", laptop.entry.id); // not bo's key: nothing happens
  await deleteAgentKey(db, "ana", laptop.entry.id);
  assert.equal(await tasteForKey(db, laptop.key), undefined);
  await setHidden(db, "ana", "vaul", false);
  assert.deepEqual([...(await tasteForKey(db, desk.key))!.hide], []);
  await deleteKey(db, desk.key);
  assert.deepEqual((await loadAccount(db, "ana")).keys, []);
  assert.equal(await tasteForKey(db, "tb_sk_made_up"), undefined);
});

test("a terminal claims one key after its code is approved, once, and only within 10 minutes", async () => {
  const db = setup();
  assert.equal(await claimLogin(db, "ABCD-EFGH"), undefined); // waiting
  assert.equal(await approveLogin(db, "ana", "ABCD-EFGH", "omarchy"), true);
  assert.equal(await approveLogin(db, "bo", "ABCD-EFGH", "theirs"), false); // a code belongs to the first approval
  const made = await claimLogin(db, "ABCD-EFGH");
  assert.ok(made && made !== "full");
  assert.equal((await keyOwner(db, made.key))?.name, "ana");
  assert.equal((await loadAccount(db, "ana")).keys[0]?.name, "omarchy");
  assert.equal(await claimLogin(db, "ABCD-EFGH"), undefined);

  await approveLogin(db, "ana", "WXYZ-2345", "old");
  (db as unknown as { exec: (s: string) => void }).exec(`update device_login set createdAt = 0`);
  assert.equal(await claimLogin(db, "WXYZ-2345"), undefined);
});

test("the taste tool's saves reach the key's owner: off-look per look, counted across users; undo clears every mark", async () => {
  const db = setup();
  const { key } = (await makeAgentKey(db, "ana", "Key"))!;
  await saveTaste(db, "ana", "kokonut-ui/pull-cord", "hide");
  await saveTaste(db, "ana", "sonner", "off-look", "minimal");
  await saveTaste(db, "ana", "sonner", "off-look", "apple");
  await saveTaste(db, "bo", "sonner", "off-look", "minimal");
  await saveTaste(db, "ana", "vaul", "like");
  const t = (await tasteForKey(db, key))!;
  assert.deepEqual({ userId: t.userId, hide: [...t.hide], like: [...t.like], minimal: [...t.offLook.get("minimal")!] }, { userId: "ana", hide: ["kokonut-ui/pull-cord"], like: ["vaul"], minimal: ["sonner"] });
  assert.deepEqual((await offLookCounts(db)).map((r) => ({ ...r })), [{ item: "sonner", look: "minimal", users: 2 }, { item: "sonner", look: "apple", users: 1 }]);
  for (const id of ["sonner", "kokonut-ui/pull-cord", "vaul"]) await saveTaste(db, "ana", id, "undo");
  const after = (await tasteForKey(db, key))!;
  assert.deepEqual([after.hide.size, after.offLook.size, after.like.size], [0, 0, 0]);
});

test("editor's picks list newest first; re-wording keeps a pick's place, unpicking drops it", async () => {
  const db = setup();
  await setPick(db, "vaul", "The drawer that feels native.");
  await setPick(db, "sonner", "Toasts with promise states.");
  await setPick(db, "vaul", "The only drawer that feels native on a phone.");
  assert.deepEqual((await listPicks(db)).map((p) => ({ ...p })), [
    { id: "sonner", reason: "Toasts with promise states." },
    { id: "vaul", reason: "The only drawer that feels native on a phone." },
  ]);
  await setPick(db, "sonner", null);
  assert.deepEqual((await listPicks(db)).map((p) => p.id), ["vaul"]);
});

test("only a verified email on ADMIN_EMAILS may pick; an unset list means nobody", () => {
  const ana = { email: "Ana@x.dev", emailVerified: true };
  assert.equal(isAdmin(ana, " bo@x.dev, ana@x.dev"), true);
  assert.equal(isAdmin(ana, "bo@x.dev"), false);
  assert.equal(isAdmin(ana, undefined), false);
  assert.equal(isAdmin(ana, ""), false);
  assert.equal(isAdmin({ ...ana, emailVerified: false }, "ana@x.dev"), false);
});

test("saved defaults and single off-look marks reach the agent key and the account, and only that user's", async () => {
  const db = setup();
  const { key, entry } = (await makeAgentKey(db, "ana", "Key"))!;
  assert.deepEqual(await tasteForUser(db, "ana").then((t) => t && [t.look, t.framework]), [undefined, undefined]);
  await setPrefs(db, "ana", { look: "glass", framework: "vue" });
  await setPrefs(db, "ana", { look: "neo-brutalism", framework: null });
  await setOffLook(db, "ana", "sonner", "minimal", true);
  await setOffLook(db, "ana", "sonner", "glass", true);
  await setOffLook(db, "ana", "sonner", "glass", false);
  const t = (await tasteForKey(db, key))!;
  assert.deepEqual([t.look, t.framework, [...t.offLook.keys()], [...t.offLook.get("minimal")!]], ["neo-brutalism", undefined, ["minimal"], ["sonner"]]);
  const a = await loadAccount(db, "ana");
  assert.deepEqual([a.look, a.framework, a.offLook], ["neo-brutalism", null, [{ item: "sonner", look: "minimal" }]]);
  assert.equal((await tasteForUser(db, "bo"))!.look, undefined);
  await deleteAgentKey(db, "ana", entry.id);
  assert.equal(await tasteForKey(db, key), undefined);
  assert.deepEqual((await loadAccount(db, "ana")).keys, []);
});
