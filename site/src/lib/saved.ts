// Client-side: what this visitor saved, shared by every island on the page. Signed out, hearts live in localStorage
// (synced across tabs). Signed in, hearts and folders live in the account (D1, via /api/*) and follow them to any
// device; the first sign-in on a device moves its local hearts (and look) into the account. Signed in only: what they hid
// from their agent or marked wrong for one look, their default look and framework, and their agent keys, by
// name and last 4 characters (/mcp reads all of it through a key).
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Provider } from "./auth.ts";
import type { AccountData, AgentKey, Folder, Prefs, SiteRequest } from "./auth-data.ts";

export type { AgentKey, Folder, Prefs, Provider, SiteRequest };
export type User = { name: string; image: string | null };
/** Something the user hid from their agent, with the name and page the account sheet lists it by. */
export type Hidden = { id: string; name: string; href: string };
/** Something left out of the agent's answers under one look only. */
export type OffLook = Hidden & { look: string };
/** `loading`: this browser signed in before and /api/me has not answered yet. `admin`: may set editor's picks. */
type State = { user: User | null; loading: boolean; saved: string[]; folders: Folder[]; hidden: Hidden[]; offLook: OffLook[]; keys: AgentKey[]; admin: boolean } & Prefs;

const KEY = "tastebase:saved";
// Set when this browser starts a sign-in, cleared on sign-out. Without it no page asks /api/me, so signed-out visits
// stay static and cost the Worker nothing.
const SIGNED_IN = "tastebase:account";
// A look chosen while signed out (the taste survey); the first sign-in saves it when the account has none.
const LOOK = "tastebase:look";
const EMPTY: State = { user: null, loading: false, saved: [], folders: [], hidden: [], offLook: [], keys: [], admin: false, look: null, framework: null };
const subs = new Set<() => void>();
let state: State | undefined;

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch {}
  },
};

// Storage can throw (private mode, blocked site data) or hold junk; either way the list starts empty.
function readLocal(): string[] {
  try {
    const v: unknown = JSON.parse(store.get(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const set = (next: Partial<State>) => ((state = { ...snapshot(), ...next }), subs.forEach((f) => f()));

function snapshot(): State {
  if (state) return state;
  state = { ...EMPTY, saved: readLocal(), look: store.get(LOOK), loading: !!store.get(SIGNED_IN) };
  if (state.loading) void load();
  return state;
}

// Taste writes (hearts, hides, look, framework, off-look marks) go out one at a time, in the order they were made. Each
// reads its body when it goes out, so it carries the latest state, and a quick undo can never land first. A failed one
// says so and reads the account again: the server is the truth. `edits` counts them, so a read of /api/me that one
// overlapped is known to be older than the screen and its taste is dropped.
let queue = Promise.resolve();
let edits = 0;
function write(method: string, url: string, body: () => unknown, done?: () => void) {
  edits++;
  queue = queue.then(() =>
    api(method, url, body()).then(
      () => done?.(),
      (e) => (fail(e), void queue.then(() => load(true))),
    ),
  );
}
/** Resolves once every taste write made so far has reached the server: what /api/try then reads. */
export const tasteSaved = () => queue;

let imported = false; // what this browser kept signed out joins the account once per page, even if that write fails

/** Reads the account. `recover`: after a failed write, only the taste fields, only while still signed in, and again
 *  once newer writes land if one overlapped the read. */
async function load(recover = false) {
  const at = edits;
  await queue;
  const me = await api<{ user: User | null; hidden?: Hidden[]; offLook?: OffLook[]; admin?: boolean } & Partial<Omit<AccountData, "hidden" | "offLook">>>("GET", "/api/me").catch(() => undefined);
  // A network or server error keeps what is shown and the signed-in flag; only an answer of "no user" signs out.
  if (!me) return set({ loading: false });
  if (recover && !snapshot().user) return;
  if (!me.user) return store.set(SIGNED_IN, null), set({ ...EMPTY, saved: readLocal(), look: store.get(LOOK) });
  if (at !== edits && recover) return void queue.then(() => load(true));
  const local = readLocal();
  const taste = at === edits ? { saved: [...new Set([...(me.saved ?? []), ...local])], hidden: me.hidden ?? [], offLook: me.offLook ?? [], look: me.look ?? null, framework: me.framework ?? null } : {};
  if (recover) return set(taste);
  set({ user: me.user, loading: false, folders: me.folders ?? [], keys: me.keys ?? [], admin: !!me.admin, ...taste });
  if (imported) return;
  imported = true;
  const localLook = store.get(LOOK);
  // Kept in this browser until the account has it, so a failed write retries on the next page load.
  if (localLook && !me.look) set({ look: localLook }), write("POST", "/api/prefs", () => ({ look: snapshot().look, framework: snapshot().framework }), () => store.set(LOOK, null));
  else store.set(LOOK, null);
  if (local.length) write("POST", "/api/saved", () => ({ merge: local }), () => store.set(KEY, null));
}

/** Reads the account again: the agent's taste tool may have changed it since this page loaded. */
export const refreshAccount = () => (snapshot().user ? load() : Promise.resolve());

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && !snapshot().user && set({ saved: readLocal() });
  subs.add(cb);
  addEventListener("storage", onStorage);
  return () => (subs.delete(cb), removeEventListener("storage", onStorage));
}

async function api<T = { ok: true }>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const out = (await r.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!r.ok) throw new Error(out.error ?? out.message ?? (r.status === 404 ? "Sign-in is not set up here." : `Request failed (${r.status}).`));
  return out;
}
const fail = (e: unknown) => void toast.error((e as Error).message);

/** Everything at once: the signed-in user (null when signed out), hearts and folders. Empty on the server and on the
 *  first client render, so hydration matches. */
export const useAccount = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);
/** Saved ids, oldest first. */
export const useSaved = () => useAccount().saved;

export function toggleSaved(id: string) {
  const { user, saved } = snapshot();
  const on = !saved.includes(id);
  set({ saved: on ? [...saved, id] : saved.filter((x) => x !== id) });
  if (!user) return store.set(KEY, JSON.stringify(snapshot().saved));
  // A heart still waiting in a failed first-sign-in import must not come back with it.
  if (!on && readLocal().includes(id)) store.set(KEY, JSON.stringify(readLocal().filter((x) => x !== id)));
  write("POST", "/api/saved", () => ({ lib: id, on: snapshot().saved.includes(id) }));
}

/** Hearts several libraries at once (the taste survey); ones already hearted stay as they are. */
export function saveAll(ids: string[]) {
  const { user, saved } = snapshot();
  const add = ids.filter((id) => !saved.includes(id));
  if (!add.length) return;
  set({ saved: [...saved, ...add] });
  if (!user) return store.set(KEY, JSON.stringify(snapshot().saved));
  write("POST", "/api/saved", () => ({ merge: add }));
}

/** Whether the user hid this library or resource from their agent. */
export const useHidden = (id: string) => useAccount().hidden.some((h) => h.id === id);

/** Hides or unhides a library or resource from the user's agent. Signed out, it asks them to sign in first. */
export function toggleHidden(item: Hidden) {
  const { user, hidden } = snapshot();
  if (!user) return askSignIn();
  const on = !hidden.some((h) => h.id === item.id);
  set({ hidden: on ? [...hidden, item] : hidden.filter((h) => h.id !== item.id) });
  write("POST", "/api/hidden", () => ({ item: item.id, on: snapshot().hidden.some((h) => h.id === item.id) }));
}

/** Sets the user's default look or framework for their agent (null: detect, as for everyone). Signed out, only the look,
 *  kept in this browser until the first sign-in. Callers wait while the account loads. */
export function setPrefs(p: Partial<Prefs>) {
  const { user, look, framework } = snapshot();
  const next = { look, framework, ...p };
  set(next);
  if (!user) return store.set(LOOK, next.look);
  // Once a choice is saved, a look still waiting from a failed first-sign-in import is out of date.
  write("POST", "/api/prefs", () => ({ look: snapshot().look, framework: snapshot().framework }), () => store.set(LOOK, null));
}

/** Leaves an item out under one look only, or brings it back there. */
export function toggleOffLook(item: OffLook) {
  const { user, offLook } = snapshot();
  if (!user) return askSignIn();
  const same = (x: OffLook) => x.id === item.id && x.look === item.look;
  const on = !offLook.some(same);
  set({ offLook: on ? [...offLook, item] : offLook.filter((x) => !same(x)) });
  write("POST", "/api/off-look", () => ({ item: item.id, look: item.look, on: snapshot().offLook.some(same) }));
}

/** Signs out the agent holding one key; the others keep working. Resolves whether it worked. */
export async function revokeAgentKey(id: string) {
  const ok = !!(await api("DELETE", `/api/agent-key?id=${encodeURIComponent(id)}`).catch(fail));
  if (ok) set({ keys: snapshot().keys.filter((k) => k.id !== id) });
  return ok;
}

/** Deletes the account and everything in it. Resolves "stale" when the session is over a day old: better-auth wants a
 *  fresh sign-in first. */
export async function deleteAccount(): Promise<"done" | "stale" | "failed"> {
  const r = await api("POST", "/api/auth/delete-user", {}).then(
    () => "done" as const,
    (e: Error) => (/expired|re-?authenticate/i.test(e.message) ? ("stale" as const) : (fail(e), "failed" as const)),
  );
  if (r === "done") store.set(SIGNED_IN, null), set({ ...EMPTY, saved: readLocal() });
  return r;
}

/** A new agent key next to the others. Resolves to the key itself, the only time the browser sees it. */
export async function makeAgentKey() {
  const r = await api<{ key: string; entry: AgentKey }>("POST", "/api/agent-key", {}).catch(fail);
  if (r) set({ keys: [...snapshot().keys, r.entry] });
  return r?.key;
}

/** Approves a terminal's login `id` (`tastebase login`), which then signs in as this session's user. Resolves to the
 *  account the server approved for (another tab may have switched it), or to what went wrong. */
export const approveLogin = (id: string, name: string) =>
  api<{ account: string }>("POST", "/api/connect", { id, name }).then(({ account }) => ({ account }), (e: Error) => ({ error: e.message }));

let offered: Promise<Provider[]> | undefined;
/** The providers this stage signs in with, asked once when the sign-in sheet first opens. Empty: sign-in is not set up. */
export const signInProviders = () => (offered ??= api<{ providers?: Provider[] }>("GET", "/api/me").then((m) => m.providers ?? [], () => ((offered = undefined), [])));

/** Sends the browser to the provider and back to this page, signed in. */
export async function signIn(provider: Provider) {
  store.set(SIGNED_IN, "1");
  try {
    const { url } = await api<{ url: string }>("POST", "/api/auth/sign-in/social", { provider, callbackURL: location.pathname + location.search + location.hash });
    location.assign(url);
  } catch (e) {
    store.set(SIGNED_IN, null);
    fail(e);
  }
}

export async function signOut() {
  await api("POST", "/api/auth/sign-out", {}).catch(fail);
  store.set(SIGNED_IN, null);
  set({ ...EMPTY, saved: readLocal() });
}

// Folder writes go out one at a time, in the order they were made: two quick clicks on Private and Anyone with the link
// must land in that order, or the folder stays shared while the screen says Private.
let folderWrites: Promise<unknown> = Promise.resolve();
const folderWrite = <T,>(f: () => Promise<T>) => (folderWrites = folderWrites.then(f, f));

const putFolder = (id: string, f: (x: Folder) => Folder | null) => set({ folders: snapshot().folders.flatMap((x) => (x.id === id ? (f(x) ?? []) : [x])) });

/** Makes a folder (with `lib` filed in it, if given). Resolves to its id, or undefined when the server refused. */
export async function createFolder(name: string, lib?: string) {
  const f = await api<Folder>("POST", "/api/folders", { name, lib }).catch(fail);
  if (f) set({ folders: [...snapshot().folders, f] });
  return f?.id;
}

/** Renames, shares or unshares one of your folders, or files a library in or out of it. Optimistic; undone on failure. */
export function updateFolder(id: string, p: { name?: string; public?: boolean; add?: string; remove?: string }) {
  const before = snapshot().folders;
  putFolder(id, (f) => ({
    ...f,
    name: p.name ?? f.name,
    public: p.public ?? f.public,
    libs: p.add ? [...new Set([...f.libs, p.add])] : p.remove ? f.libs.filter((l) => l !== p.remove) : f.libs,
  }));
  return folderWrite(() => api("PATCH", `/api/folders/${id}`, p)).then(
    () => true,
    (e) => (fail(e), set({ folders: before }), false),
  );
}

export function deleteFolder(id: string) {
  const before = snapshot().folders;
  putFolder(id, () => null);
  return folderWrite(() => api("DELETE", `/api/folders/${id}`)).then(
    () => true,
    (e) => (fail(e), set({ folders: before }), false),
  );
}

/** The user's requests to list a site, and an admin's queue. Asked when the Requests panel opens (and for the download). */
export const loadRequests = () => api<{ mine: SiteRequest[]; open?: SiteRequest[] }>("GET", "/api/requests");

/** Files a request. Resolves to it, or to what went wrong: `field` names the input at fault, `request` is the earlier
 *  request for the same link. */
export async function sendRequest(url: string, note: string): Promise<{ request: SiteRequest } | { error: string; field?: string; request?: SiteRequest }> {
  const r = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, note }) }).catch(() => undefined);
  const out = ((await r?.json().catch(() => ({}))) ?? {}) as { request?: SiteRequest; error?: string; field?: string };
  return r?.ok && out.request ? { request: out.request } : { error: out.error ?? "Couldn't send that. Check your connection.", field: out.field, request: out.request };
}

/** An admin settles every waiting request for a link: added as a registry id, or declined with a reason. */
export const settleRequest = (url: string, s: { status: "added"; libId: string } | { status: "declined"; reason: string }) =>
  api<{ settled: number }>("PATCH", "/api/requests", { url, ...s }).then((r) => r.settled, (e) => (fail(e), undefined));

/** Opens the sign-in dialog (AccountButton listens), e.g. when a signed-out visitor reaches for a folder. */
export const askSignIn = () => dispatchEvent(new Event("tb:signin"));
