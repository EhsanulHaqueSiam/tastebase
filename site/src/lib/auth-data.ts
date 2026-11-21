// Server-only: hearts and folders in D1 (tables in migrations/0001_accounts.sql). Plain SQL over the D1 binding so
// tests can run it on node:sqlite. Every write is scoped to the signed-in user; callers validate lib ids first.

export type Folder = { id: string; name: string; public: boolean; libs: string[] };
/** What the browser holds for a signed-in user: GET /api/me. */
export type AccountData = { saved: string[]; folders: Folder[] };
/** A folder as /f/<id> shows it: whose it is, and whether the viewer may edit it. */
export type SharedFolder = Folder & { owner: { name: string; image: string | null }; mine: boolean };

type Row = { id: string; name: string; public: number; libs: string | null };
const toFolder = (r: Row): Folder => ({ id: r.id, name: r.name, public: !!r.public, libs: r.libs ? r.libs.split(",") : [] });
// Registry ids are [a-z0-9-], so a comma joins them safely.
const FOLDER_COLS = `f.id, f.name, f.public, (select group_concat(lib, ',') from (select lib from folder_lib where folderId = f.id order by createdAt, rowid)) as libs`;

export const MAX_FOLDERS = 100;

export async function loadAccount(db: D1Database, userId: string): Promise<AccountData> {
  const [saved, folders] = await db.batch([
    db.prepare(`select lib from saved where userId = ? order by createdAt, rowid`).bind(userId),
    db.prepare(`select ${FOLDER_COLS} from folder f where f.userId = ? order by f.createdAt, f.id`).bind(userId),
  ]);
  return { saved: (saved!.results as { lib: string }[]).map((r) => r.lib), folders: (folders!.results as Row[]).map(toFolder) };
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
