// Server-only: hearts, folders, hidden items, agent keys and editor's picks in D1 (tables in migrations/). Plain SQL
// over the D1 binding so
// tests can run it on node:sqlite. Every write is scoped to the signed-in user; callers validate lib ids first.

export type Folder = { id: string; name: string; public: boolean; libs: string[] };
/** What the browser holds for a signed-in user: GET /api/me. `key`: the last 4 characters of their agent key, if any. */
export type AccountData = { saved: string[]; folders: Folder[]; hidden: string[]; key: string | null };
/** A folder as /f/<id> shows it: whose it is, and whether the viewer may edit it. */
export type SharedFolder = Folder & { owner: { name: string; image: string | null }; mine: boolean };

type Row = { id: string; name: string; public: number; libs: string | null };
const toFolder = (r: Row): Folder => ({ id: r.id, name: r.name, public: !!r.public, libs: r.libs ? r.libs.split(",") : [] });
// Registry ids are [a-z0-9-], so a comma joins them safely.
const FOLDER_COLS = `f.id, f.name, f.public, (select group_concat(lib, ',') from (select lib from folder_lib where folderId = f.id order by createdAt, rowid)) as libs`;

export const MAX_FOLDERS = 100;

export async function loadAccount(db: D1Database, userId: string): Promise<AccountData> {
  const [saved, folders, hidden, key] = await db.batch([
    db.prepare(`select lib from saved where userId = ? order by createdAt, rowid`).bind(userId),
    db.prepare(`select ${FOLDER_COLS} from folder f where f.userId = ? order by f.createdAt, f.id`).bind(userId),
    db.prepare(`select item from hidden where userId = ? order by createdAt, rowid`).bind(userId),
    db.prepare(`select last4 from agent_key where userId = ?`).bind(userId),
  ]);
  return {
    saved: (saved!.results as { lib: string }[]).map((r) => r.lib),
    folders: (folders!.results as Row[]).map(toFolder),
    hidden: (hidden!.results as { item: string }[]).map((r) => r.item),
    key: (key!.results[0] as { last4: string } | undefined)?.last4 ?? null,
  };
}

/** Hide or unhide one library or resource from the user's agent. */
export async function setHidden(db: D1Database, userId: string, item: string, on: boolean) {
  await (on
    ? db.prepare(`insert or ignore into hidden (userId, item, createdAt) values (?, ?, ?)`).bind(userId, item, Date.now())
    : db.prepare(`delete from hidden where userId = ? and item = ?`).bind(userId, item)
  ).run();
}

const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** A new agent key for the user, replacing any old one (which stops working at once). Only its hash is stored. */
export async function makeAgentKey(db: D1Database, userId: string): Promise<string> {
  const key = `tb_sk_${Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => ALPHABET[b % 32]).join("")}`;
  await db
    .prepare(`insert into agent_key (userId, hash, last4, createdAt) values (?, ?, ?, ?) on conflict (userId) do update set hash = excluded.hash, last4 = excluded.last4, createdAt = excluded.createdAt`)
    .bind(userId, await sha256(key), key.slice(-4), Date.now())
    .run();
  return key;
}

/** What an agent key's owner hid and hearted, in one read; undefined for an unknown key. */
export async function tasteForKey(db: D1Database, key: string): Promise<{ hide: Set<string>; like: Set<string> } | undefined> {
  const row = await db
    .prepare(
      `select (select group_concat(item, ',') from hidden h where h.userId = k.userId) as hide, (select group_concat(lib, ',') from saved s where s.userId = k.userId) as "like" from agent_key k where k.hash = ?`,
    )
    .bind(await sha256(key))
    .first<{ hide: string | null; like: string | null }>();
  if (!row) return undefined;
  const ids = (v: string | null) => new Set(v ? v.split(",") : []);
  return { hide: ids(row.hide), like: ids(row.like) };
}

/** Heart or unheart one library. */
export async function setSaved(db: D1Database, userId: string, lib: string, on: boolean) {
  await (on
    ? db.prepare(`insert or ignore into saved (userId, lib, createdAt) values (?, ?, ?)`).bind(userId, lib, Date.now())
    : db.prepare(`delete from saved where userId = ? and lib = ?`).bind(userId, lib)
  ).run();
}

/** Adds the browser's signed-out hearts to the account (first sign-in on a device). Hearts already there stay put. */
export async function mergeSaved(db: D1Database, userId: string, libs: string[]) {
  if (!libs.length) return;
  const now = Date.now();
  await db.batch(libs.map((lib) => db.prepare(`insert or ignore into saved (userId, lib, createdAt) values (?, ?, ?)`).bind(userId, lib, now)));
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l, so a share link read aloud survives
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALPHABET[b % 32]).join("");

/** Null when the user already has MAX_FOLDERS. `lib` files a first library into it. */
export async function createFolder(db: D1Database, userId: string, name: string, lib?: string): Promise<Folder | null> {
  const id = newId();
  const now = Date.now();
  const res = await db
    .prepare(`insert into folder (id, userId, name, public, createdAt) select ?, ?, ?, 0, ? where (select count(*) from folder where userId = ?) < ?`)
    .bind(id, userId, name, now, userId, MAX_FOLDERS)
    .run();
  if (!res.meta.changes) return null;
  if (lib) await db.prepare(`insert into folder_lib (folderId, lib, createdAt) values (?, ?, ?)`).bind(id, lib, now).run();
  return { id, name, public: false, libs: lib ? [lib] : [] };
}

export type FolderPatch = { name?: string; public?: boolean; add?: string; remove?: string };

/** Applies a patch to the user's own folder. False when the folder is not theirs (or does not exist). */
export async function updateFolder(db: D1Database, userId: string, id: string, p: FolderPatch): Promise<boolean> {
  const own = await db.prepare(`select 1 from folder where id = ? and userId = ?`).bind(id, userId).first();
  if (!own) return false;
  const ss: D1PreparedStatement[] = [];
  if (p.name !== undefined) ss.push(db.prepare(`update folder set name = ? where id = ?`).bind(p.name, id));
  if (p.public !== undefined) ss.push(db.prepare(`update folder set public = ? where id = ?`).bind(p.public ? 1 : 0, id));
  if (p.add) ss.push(db.prepare(`insert or ignore into folder_lib (folderId, lib, createdAt) values (?, ?, ?)`).bind(id, p.add, Date.now()));
  if (p.remove) ss.push(db.prepare(`delete from folder_lib where folderId = ? and lib = ?`).bind(id, p.remove));
  if (ss.length) await db.batch(ss);
  return true;
}

export async function deleteFolder(db: D1Database, userId: string, id: string): Promise<boolean> {
  const res = await db.prepare(`delete from folder where id = ? and userId = ?`).bind(id, userId).run();
  return !!res.meta.changes;
}

/** A folder for /f/<id>: anyone may read a public one, only its owner a private one. Null otherwise. */
export async function readFolder(db: D1Database, id: string, viewerId: string | undefined): Promise<SharedFolder | null> {
  const r = await db
    .prepare(`select ${FOLDER_COLS}, f.userId, u.name as ownerName, u.image as ownerImage from folder f join user u on u.id = f.userId where f.id = ?`)
    .bind(id)
    .first<Row & { userId: string; ownerName: string; ownerImage: string | null }>();
  if (!r) return null;
  const mine = r.userId === viewerId;
  if (!r.public && !mine) return null;
  return { ...toFolder(r), owner: { name: r.ownerName, image: r.ownerImage }, mine };
}

/** Whether a signed-in user may set editor's picks: a verified email on the comma-separated ADMIN_EMAILS list. Unset
 *  list, nobody. Verified, because X may share no email and better-auth then stores a placeholder. */
export const isAdmin = (user: { email: string; emailVerified: boolean }, list: string | undefined) =>
  user.emailVerified && !!list?.split(",").some((e) => e.trim().toLowerCase() === user.email.toLowerCase());

export type EditorPick = { id: string; reason: string };

/** Every editor's pick, newest first. */
export async function listPicks(db: D1Database): Promise<EditorPick[]> {
  const { results } = await db.prepare(`select item as id, reason from editor_pick order by createdAt desc, rowid desc`).all<EditorPick>();
  return results;
}

/** Picks an item with its reason (editing the reason keeps its place), or unpicks it when `reason` is null. */
export async function setPick(db: D1Database, item: string, reason: string | null) {
  await (reason === null
    ? db.prepare(`delete from editor_pick where item = ?`).bind(item)
    : db.prepare(`insert into editor_pick (item, reason, createdAt) values (?, ?, ?) on conflict (item) do update set reason = excluded.reason`).bind(item, reason, Date.now())
  ).run();
}
