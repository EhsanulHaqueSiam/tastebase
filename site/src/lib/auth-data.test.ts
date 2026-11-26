/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { approveLogin, claimLogin, createRequest, MAX_KEYS, MAX_OPEN_REQUESTS, MAX_REQUESTS_A_DAY, myRequests, openRequests, settleRequests, siteUrl, createFolder, deleteAgentKey, deleteKey, keyOwner, deleteFolder, isAdmin, listPicks, loadAccount, makeAgentKey, mergeSaved, offLookCounts, readFolder, saveTaste, setHidden, setOffLook, setPick, setPrefs, setSaved, tasteForKey, tasteForUser, updateFolder } from "./auth-data.ts";
import { memoryD1 } from "./d1-shim.test-util.ts";

function setup() {
  const d1 = memoryD1();
  for (const m of ["0001_accounts", "0002_taste", "0003_editor_picks", "0004_off_look", "0005_pref", "0006_agent_keys", "0007_site_request"]) d1.exec(readFileSync(new URL(`../../../migrations/${m}.sql`, import.meta.url), "utf8"));
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

test("a terminal claims one key after its login is approved, once, and only within 10 minutes", async () => {
  const db = setup();
  const id = "a".repeat(64);
  assert.equal(await claimLogin(db, id), undefined); // waiting
  assert.equal(await approveLogin(db, "ana", id, "omarchy"), "ok");
  assert.equal(await approveLogin(db, "bo", id, "theirs"), "approved"); // a login belongs to the first approval
  const made = await claimLogin(db, id);
  assert.ok(made && made !== "refused");
  assert.equal((await keyOwner(db, made.key))?.name, "ana");
  assert.equal((await loadAccount(db, "ana")).keys[0]?.name, "omarchy");
  assert.equal(await claimLogin(db, id), "refused"); // a second claim makes nothing
  assert.equal(await approveLogin(db, "ana", id, "again"), "approved"); // nor does approving the used link again
  assert.equal((await loadAccount(db, "ana")).keys.length, 1);

  const full = "b".repeat(64);
  for (let i = 0; i < MAX_KEYS - 1; i++) await makeAgentKey(db, "bo", `k${i}`);
  assert.equal(await approveLogin(db, "bo", full, "the last one"), "ok");
  await makeAgentKey(db, "bo", "made meanwhile"); // the account fills up between approval and claim
  assert.equal(await claimLogin(db, full), "refused");
  assert.equal(await approveLogin(db, "bo", "e".repeat(64), "one too many"), "full"); // refused up front, not after

  // An approval that expired and was approved again by someone else makes a key for the one approving now.
  const reused = "d".repeat(64);
  await approveLogin(db, "ana", reused, "ana's");
  (db as unknown as { exec: (s: string) => void }).exec(`update device_login set createdAt = 0 where id = '${reused}'`);
  (db as unknown as { exec: (s: string) => void }).exec(`delete from agent_key where userId = 'bo'`);
  assert.equal(await approveLogin(db, "bo", reused, "bo's"), "ok"); // the stale approval was cleared
  const now = await claimLogin(db, reused);
  assert.ok(now && now !== "refused");
  assert.deepEqual([(await keyOwner(db, now.key))?.name, now.entry.name], ["bo", "bo's"]);

  const old = "c".repeat(64);
  await approveLogin(db, "ana", old, "old");
  (db as unknown as { exec: (s: string) => void }).exec(`update device_login set createdAt = 0 where id = '${old}'`);
  assert.equal(await claimLogin(db, old), undefined);
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

test("a site request is https only and normalized, once per user per link, within the open and daily caps", async () => {
  assert.deepEqual(siteUrl(" https://WWW.MagicUI.design/docs/#top "), { url: "https://magicui.design/docs", host: "magicui.design" });
  for (const bad of ["http://x.dev", "javascript:alert(1)", "https://localhost", "https://www.com", "not a url", 7]) assert.equal(siteUrl(bad), undefined);
  // Normalizing a stored link again gives it back unchanged: an admin settles by it. www. and the bare host are one site.
  for (const v of ["https://example.com/docs//", "https://www.x.dev/", "https://www.www.x.dev", "https://x.dev", "https://x.dev/p?item=docs/"]) assert.equal(siteUrl(siteUrl(v)!.url)!.url, siteUrl(v)!.url);
  assert.equal(siteUrl("https://www.x.dev")!.url, siteUrl("https://x.dev")!.url);
  assert.equal(siteUrl(`https://x.dev/${"é".repeat(200)}`), undefined); // over 500 once encoded
  assert.equal(siteUrl("https://x.dev/p?item=docs/")!.url, "https://x.dev/p?item=docs/"); // the query is left alone

  const db = setup();
  const at = (u: string) => siteUrl(u)!;
  assert.ok("ok" in (await createRequest(db, "ana", at("https://uiverse.io"), "buttons")));
  const again = await createRequest(db, "ana", at("https://uiverse.io/"), "");
  assert.equal("duplicate" in again && again.duplicate?.status, "open"); // the same link, said differently
  assert.ok("ok" in (await createRequest(db, "bo", at("https://uiverse.io"), ""))); // someone else may ask too

  for (let i = 1; i < MAX_REQUESTS_A_DAY; i++) assert.ok("ok" in (await createRequest(db, "ana", at(`https://site${i}.dev`), "")));
  assert.ok("limit" in (await createRequest(db, "ana", at("https://one-too-many.dev"), ""))); // 5 a day
  (db as unknown as { exec: (s: string) => void }).exec(`update site_request set createdAt = 0`);
  for (let i = MAX_REQUESTS_A_DAY; i < MAX_OPEN_REQUESTS; i++) assert.ok("ok" in (await createRequest(db, "ana", at(`https://site${i}.dev`), "")));
  (db as unknown as { exec: (s: string) => void }).exec(`update site_request set createdAt = 0`);
  assert.ok("limit" in (await createRequest(db, "ana", at("https://eleventh.dev"), ""))); // 10 waiting

  // Settling a link settles every user's request for it; the queue shows names, never emails.
  assert.deepEqual((await openRequests(db)).filter((r) => r.host === "uiverse.io").map((r) => r.by), ["ana", "bo"]);
  assert.equal(await settleRequests(db, "https://uiverse.io", { status: "added", libId: "uiverse" }), 2);
  const [mine] = (await myRequests(db, "bo")).filter((r) => r.host === "uiverse.io");
  assert.deepEqual([mine?.status, mine?.libId], ["added", "uiverse"]);
  assert.equal(await settleRequests(db, "https://uiverse.io", { status: "declined", reason: "late" }), 0); // already settled
  assert.ok("ok" in (await createRequest(db, "ana", at("https://eleventh.dev"), ""))); // an added one frees a slot
});
