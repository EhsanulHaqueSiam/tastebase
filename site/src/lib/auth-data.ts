import type { Framework } from "../../../src/registry/schema.ts";
import type { TasteAction } from "../../../src/taste.ts";

// Server-only: hearts, folders, hidden items, off-look marks, agent keys, site requests and editor's picks in D1 (tables in migrations/). Plain SQL
// over the D1 binding so
// tests can run it on node:sqlite. Every write is scoped to the signed-in user; callers validate lib ids first.

export type Folder = { id: string; name: string; public: boolean; libs: string[] };
/** A user's defaults for their agent when a brief names none; null means detect, as for everyone. */
export type Prefs = { look: string | null; framework: Framework | null };
/** One agent key as the account lists it: never the key itself, only its last 4 characters. */
export type AgentKey = { id: string; name: string; last4: string; createdAt: number };
/** What the browser holds for a signed-in user: GET /api/me. `keys`: their agent keys, oldest first. `offLook`: items
 *  left out under one look only. */
export type AccountData = { saved: string[]; folders: Folder[]; hidden: string[]; offLook: { item: string; look: string }[]; keys: AgentKey[] } & Prefs;
/** A folder as /f/<id> shows it: whose it is, and whether the viewer may edit it. */
export type SharedFolder = Folder & { owner: { name: string; image: string | null }; mine: boolean };

type Row = { id: string; name: string; public: number; libs: string | null };
const toFolder = (r: Row): Folder => ({ id: r.id, name: r.name, public: !!r.public, libs: r.libs ? r.libs.split(",") : [] });
// Registry ids are [a-z0-9-], so a comma joins them safely.
const FOLDER_COLS = `f.id, f.name, f.public, (select group_concat(lib, ',') from (select lib from folder_lib where folderId = f.id order by createdAt, rowid)) as libs`;

export const MAX_FOLDERS = 100;

export async function loadAccount(db: D1Database, userId: string): Promise<AccountData> {
  const [saved, folders, hidden, offLook, keys, pref] = await db.batch([
    db.prepare(`select lib from saved where userId = ? order by createdAt, rowid`).bind(userId),
    db.prepare(`select ${FOLDER_COLS} from folder f where f.userId = ? order by f.createdAt, f.id`).bind(userId),
    db.prepare(`select item from hidden where userId = ? order by createdAt, rowid`).bind(userId),
    db.prepare(`select item, look from off_look where userId = ? order by createdAt, rowid`).bind(userId),
    db.prepare(`select id, name, last4, createdAt from agent_key where userId = ? order by createdAt, rowid`).bind(userId),
    db.prepare(`select look, framework from pref where userId = ?`).bind(userId),
  ]);
  const p = pref!.results[0] as Prefs | undefined;
  return {
    saved: (saved!.results as { lib: string }[]).map((r) => r.lib),
    folders: (folders!.results as Row[]).map(toFolder),
    hidden: (hidden!.results as { item: string }[]).map((r) => r.item),
    offLook: (offLook!.results as { item: string; look: string }[]).map(({ item, look }) => ({ item, look })),
    keys: (keys!.results as AgentKey[]).map(({ id, name, last4, createdAt }) => ({ id, name, last4, createdAt })),
    look: p?.look ?? null,
    framework: p?.framework ?? null,
  };
}

/** Sets both defaults at once; callers validate the look and framework ids. */
export async function setPrefs(db: D1Database, userId: string, { look, framework }: Prefs) {
  await db
    .prepare(`insert into pref (userId, look, framework, updatedAt) values (?, ?, ?, ?) on conflict (userId) do update set look = excluded.look, framework = excluded.framework, updatedAt = excluded.updatedAt`)
    .bind(userId, look, framework, Date.now())
    .run();
}

/** Leaves one item out under one look, or brings it back there. Its marks under other looks stay. */
export async function setOffLook(db: D1Database, userId: string, item: string, look: string, on: boolean) {
  await (on
    ? db.prepare(`insert or ignore into off_look (userId, item, look, createdAt) values (?, ?, ?, ?)`).bind(userId, item, look, Date.now())
    : db.prepare(`delete from off_look where userId = ? and item = ? and look = ?`).bind(userId, item, look)
  ).run();
}

/** Signs one agent out: that key stops working, the user's other keys keep working. */
export async function deleteAgentKey(db: D1Database, userId: string, id: string) {
  await db.prepare(`delete from agent_key where userId = ? and id = ?`).bind(userId, id).run();
}

/** Signs out the agent holding this key (`tastebase logout`). */
export async function deleteKey(db: D1Database, key: string) {
  await db.prepare(`delete from agent_key where hash = ?`).bind(await sha256(key)).run();
}

/** Hide or unhide one library or resource from the user's agent. */
export async function setHidden(db: D1Database, userId: string, item: string, on: boolean) {
  await (on
    ? db.prepare(`insert or ignore into hidden (userId, item, createdAt) values (?, ?, ?)`).bind(userId, item, Date.now())
    : db.prepare(`delete from hidden where userId = ? and item = ?`).bind(userId, item)
  ).run();
}

const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

export const MAX_KEYS = 20;

/** A new agent key named `name`, next to the user's others. Only its hash is stored, so `key` is the one time anyone
 *  sees it. Null when the user already has MAX_KEYS. */
export async function makeAgentKey(db: D1Database, userId: string, name: string): Promise<{ key: string; entry: AgentKey } | null> {
  const { key, entry } = newKey(name);
  const res = await db
    .prepare(`insert into agent_key (id, userId, name, hash, last4, createdAt) select ?, ?, ?, ?, ?, ? where (select count(*) from agent_key where userId = ?) < ?`)
    .bind(entry.id, userId, name, await sha256(key), entry.last4, entry.createdAt, userId, MAX_KEYS)
    .run();
  return res.meta.changes ? { key, entry } : null;
}

const newKey = (name: string) => {
  const key = `tb_sk_${Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => ALPHABET[b % 32]).join("")}`;
  return { key, entry: { id: newId(), name, last4: key.slice(-4), createdAt: Date.now() } };
};

const LOGIN_TTL_MS = 600_000;

/** The signed-in user approves a terminal's login `id` (/connect): the terminal holding its secret may claim a key named
 *  `name` in the next 10 minutes. "approved" when it already is, "full" when the user has MAX_KEYS (so the browser never
 *  says signed in while the terminal is refused). Clears stale approvals on the way. */
export async function approveLogin(db: D1Database, userId: string, id: string, name: string) {
  await db.prepare(`delete from device_login where createdAt < ?`).bind(Date.now() - LOGIN_TTL_MS).run();
  const res = await db
    .prepare(`insert or ignore into device_login (id, userId, name, createdAt) select ?, ?, ?, ? where (select count(*) from agent_key where userId = ?) < ?`)
    .bind(id, userId, name, Date.now(), userId, MAX_KEYS)
    .run();
  if (res.meta.changes) return "ok" as const;
  return (await db.prepare(`select 1 from device_login where id = ?`).bind(id).first()) ? ("approved" as const) : ("full" as const);
}

/** The terminal's poll, with `id` worked out from its secret: a new key once the user approved it, undefined while it
 *  waits, "refused" when it was already claimed or the account has MAX_KEYS. Making the key and marking the approval
 *  claimed is one transaction, so a key is made at most once and an approval is never spent without one. */
export async function claimLogin(db: D1Database, id: string) {
  const since = Date.now() - LOGIN_TTL_MS;
  if (!(await db.prepare(`select 1 from device_login where id = ? and createdAt >= ?`).bind(id, since).first())) return undefined;
  const { key, entry } = newKey("");
  const hash = await sha256(key);
  // The key takes its owner and name from the approval row it consumes, inside the transaction.
  await db.batch([
    db
      .prepare(`insert into agent_key (id, userId, name, hash, last4, createdAt) select ?, d.userId, d.name, ?, ?, ? from device_login d where d.id = ? and d.claimed = 0 and d.createdAt >= ? and (select count(*) from agent_key k where k.userId = d.userId) < ?`)
      .bind(entry.id, hash, entry.last4, entry.createdAt, id, since, MAX_KEYS),
    db.prepare(`update device_login set claimed = 1 where id = ? and exists (select 1 from agent_key where hash = ?)`).bind(id, hash),
  ]);
  const made = await db.prepare(`select name from agent_key where hash = ?`).bind(hash).first<{ name: string }>();
  return made ? { key, entry: { ...entry, name: made.name } } : ("refused" as const);
}

/** Who holds this key, for `tastebase login --token` to check it. */
export async function keyOwner(db: D1Database, key: string) {
  return (await db.prepare(`select u.name from agent_key k join user u on u.id = k.userId where k.hash = ?`).bind(await sha256(key)).first<{ name: string }>()) ?? undefined;
}

// Everything a user's taste holds, for one owner row `o` (with a userId column), in one read.
const TASTE = `select o.userId, (select group_concat(item, ',') from hidden h where h.userId = o.userId) as hide, (select group_concat(lib, ',') from saved s where s.userId = o.userId) as "like", (select group_concat(look || ' ' || item, ',') from off_look f where f.userId = o.userId) as off, p.look, p.framework from`;
type TasteRow = { userId: string; hide: string | null; like: string | null; off: string | null } & Prefs;

function toTaste(row: TasteRow | null) {
  if (!row) return undefined;
  const ids = (v: string | null) => new Set(v ? v.split(",") : []);
  const offLook = new Map<string, Set<string>>();
  for (const pair of ids(row.off)) {
    const [look = "", item = ""] = pair.split(" ");
    offLook.set(look, (offLook.get(look) ?? new Set()).add(item));
  }
  return { userId: row.userId, hide: ids(row.hide), like: ids(row.like), offLook, look: row.look ?? undefined, framework: row.framework ?? undefined };
}

/** Who owns an agent key and their taste: what they hid, hearted and marked off-look (look id -> items), and their
 *  default look and framework, in one read; undefined for an unknown key. */
export async function tasteForKey(db: D1Database, key: string) {
  return toTaste(await db.prepare(`${TASTE} agent_key o left join pref p on p.userId = o.userId where o.hash = ?`).bind(await sha256(key)).first<TasteRow>());
}

/** The same taste for a signed-in user (the site's "try your agent"), key or not. */
export async function tasteForUser(db: D1Database, userId: string) {
  return toTaste(await db.prepare(`${TASTE} (select id as userId from user where id = ?) o left join pref p on p.userId = o.userId`).bind(userId).first<TasteRow>());
}

/** One `taste` tool call for a key's owner; the tool has validated the id and look. Undo clears the item's hide, heart
 *  and off-look marks. */
export async function saveTaste(db: D1Database, userId: string, item: string, action: TasteAction, look?: string) {
  if (action === "like") return setSaved(db, userId, item, true);
  if (action === "hide") return setHidden(db, userId, item, true);
  if (action === "off-look") {
    await db.prepare(`insert or ignore into off_look (userId, item, look, createdAt) values (?, ?, ?, ?)`).bind(userId, item, look ?? "", Date.now()).run();
    return;
  }
  await db.batch(["hidden where userId = ? and item", "off_look where userId = ? and item", "saved where userId = ? and lib"].map((w) => db.prepare(`delete from ${w} = ?`).bind(userId, item)));
}

/** How many users marked each item off each look, most first: what tune-picks reads. Counts only, never who. */
export async function offLookCounts(db: D1Database) {
  const { results } = await db.prepare(`select item, look, count(*) as users from off_look group by item, look order by users desc, item limit 200`).all<{ item: string; look: string; users: number }>();
  return results;
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

/** One request to list a site. `by`: the requester's name, on the admin's list only (never their email). */
export type SiteRequest = { id: string; url: string; host: string; note: string; status: "open" | "added" | "declined"; libId: string | null; reason: string | null; createdAt: number; by?: string };

export const MAX_OPEN_REQUESTS = 10;
export const MAX_REQUESTS_A_DAY = 5;

/** A request's link from untrusted input: https only, lowercase host, no hash, no trailing slash. Undefined otherwise. */
export function siteUrl(v: unknown) {
  if (typeof v !== "string" || v.length > 500) return undefined;
  const u = URL.canParse(v.trim()) ? new URL(v.trim()) : undefined;
  if (u?.protocol !== "https:" || !u.hostname.includes(".")) return undefined;
  u.hash = "";
  return { url: u.href.replace(/\/$/, ""), host: u.hostname.replace(/^www\./, "") };
}

const REQ_COLS = `r.id, r.url, r.host, r.note, r.status, r.libId, r.reason, r.createdAt`;

/** Files a request, within the caps (MAX_OPEN_REQUESTS waiting, MAX_REQUESTS_A_DAY a day), counted in the insert itself.
 *  "duplicate" carries the user's earlier request for the same link, whatever became of it. */
export async function createRequest(db: D1Database, userId: string, { url, host }: { url: string; host: string }, note: string) {
  const r: SiteRequest = { id: newId(), url, host, note, status: "open", libId: null, reason: null, createdAt: Date.now() };
  const res = await db
    .prepare(
      `insert into site_request (id, userId, url, host, note, createdAt) select ?, ?, ?, ?, ?, ?
       where (select count(*) from site_request where userId = ? and status = 'open') < ? and (select count(*) from site_request where userId = ? and createdAt > ?) < ?
       on conflict (userId, url) do nothing`,
    )
    .bind(r.id, userId, url, host, note, r.createdAt, userId, MAX_OPEN_REQUESTS, userId, r.createdAt - 86_400_000, MAX_REQUESTS_A_DAY)
    .run();
  if (res.meta.changes) return { ok: r } as const;
  const dup = await db.prepare(`select ${REQ_COLS} from site_request r where userId = ? and url = ?`).bind(userId, url).first<SiteRequest>();
  return dup ? ({ duplicate: dup } as const) : ({ limit: true } as const);
}

/** The user's requests, newest first. */
export async function myRequests(db: D1Database, userId: string) {
  return (await db.prepare(`select ${REQ_COLS} from site_request r where userId = ? order by createdAt desc, rowid desc`).bind(userId).all<SiteRequest>()).results;
}

/** Every waiting request with the requester's name, oldest first: the admin's queue. */
export async function openRequests(db: D1Database) {
  return (await db.prepare(`select ${REQ_COLS}, u.name as by from site_request r join user u on u.id = r.userId where r.status = 'open' order by r.createdAt, r.rowid limit 200`).all<SiteRequest>()).results;
}

/** An admin settles every waiting request for one link at once: added as registry id `libId`, or declined with a reason. */
export async function settleRequests(db: D1Database, url: string, s: { status: "added"; libId: string } | { status: "declined"; reason: string }) {
  const res = await db
    .prepare(`update site_request set status = ?, libId = ?, reason = ? where url = ? and status = 'open'`)
    .bind(s.status, s.status === "added" ? s.libId : null, s.status === "declined" ? s.reason : null, url)
    .run();
  return res.meta.changes;
}
