// Client-side: what this visitor saved, shared by every island on the page. Signed out, hearts live in localStorage
// (synced across tabs). Signed in, hearts and folders live in the account (D1, via /api/*) and follow them to any
// device; the first sign-in on a device moves its local hearts into the account. Signed in only: what they hid from
// their agent, and the last 4 characters of their agent key (/mcp reads both through the key).
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Provider } from "./auth.ts";
import type { AccountData, Folder } from "./auth-data.ts";

export type { Folder, Provider };
export type User = { name: string; image: string | null };
/** Something the user hid from their agent, with the name and page the account sheet lists it by. */
export type Hidden = { id: string; name: string; href: string };
/** `loading`: this browser signed in before and /api/me has not answered yet. */
type State = { user: User | null; loading: boolean; saved: string[]; folders: Folder[]; hidden: Hidden[]; key: string | null };

const KEY = "tastebase:saved";
// Set when this browser starts a sign-in, cleared on sign-out. Without it no page asks /api/me, so signed-out visits
// stay static and cost the Worker nothing.
const SIGNED_IN = "tastebase:account";
const EMPTY: State = { user: null, loading: false, saved: [], folders: [], hidden: [], key: null };
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
  state = { ...EMPTY, saved: readLocal(), loading: !!store.get(SIGNED_IN) };
  if (state.loading) void load();
  return state;
}

async function load() {
  const me = (await api<{ user: User | null; hidden?: Hidden[] } & Partial<Omit<AccountData, "hidden">>>("GET", "/api/me").catch(() => null)) ?? { user: null };
  if (!me.user) return store.set(SIGNED_IN, null), set({ loading: false });
  const local = readLocal();
  const saved = [...new Set([...(me.saved ?? []), ...local])];
  set({ user: me.user, loading: false, saved, folders: me.folders ?? [], hidden: me.hidden ?? [], key: me.key ?? null });
  if (local.length && (await api("POST", "/api/saved", { merge: local }).catch(fail))) store.set(KEY, null);
}

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
  api("POST", "/api/saved", { lib: id, on }).catch((e) => (fail(e), set({ saved })));
}

/** Hearts several libraries at once (the taste survey); ones already hearted stay as they are. */
export function saveAll(ids: string[]) {
  const { user, saved } = snapshot();
  const add = ids.filter((id) => !saved.includes(id));
  if (!add.length) return;
  set({ saved: [...saved, ...add] });
  if (!user) return store.set(KEY, JSON.stringify(snapshot().saved));
  api("POST", "/api/saved", { merge: add }).catch((e) => (fail(e), set({ saved })));
}

/** Whether the user hid this library or resource from their agent. */
export const useHidden = (id: string) => useAccount().hidden.some((h) => h.id === id);

/** Hides or unhides a library or resource from the user's agent. Signed out, it asks them to sign in first. */
export function toggleHidden(item: Hidden) {
  const { user, hidden } = snapshot();
  if (!user) return askSignIn();
  const on = !hidden.some((h) => h.id === item.id);
  set({ hidden: on ? [...hidden, item] : hidden.filter((h) => h.id !== item.id) });
  api("POST", "/api/hidden", { item: item.id, on }).catch((e) => (fail(e), set({ hidden })));
}

/** A new agent key (the old one stops working). Resolves to the key itself, the only time the browser sees it. */
export async function makeAgentKey() {
  const r = await api<{ key: string }>("POST", "/api/agent-key", {}).catch(fail);
  if (r) set({ key: r.key.slice(-4) });
  return r?.key;
}

let offered: Promise<Provider[]> | undefined;
/** The providers this stage signs in with, asked once when the sign-in sheet first opens. Empty: sign-in is not set up. */
export const signInProviders = () => (offered ??= api<{ providers?: Provider[] }>("GET", "/api/me").then((m) => m.providers ?? [], () => ((offered = undefined), [])));

/** Sends the browser to the provider and back to this page, signed in. */
export async function signIn(provider: Provider) {
  store.set(SIGNED_IN, "1");
  try {
    const { url } = await api<{ url: string }>("POST", "/api/auth/sign-in/social", { provider, callbackURL: location.pathname + location.search });
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
  return api("PATCH", `/api/folders/${id}`, p).then(
    () => true,
    (e) => (fail(e), set({ folders: before }), false),
  );
}

export function deleteFolder(id: string) {
  const before = snapshot().folders;
  putFolder(id, () => null);
  return api("DELETE", `/api/folders/${id}`).then(
    () => true,
    (e) => (fail(e), set({ folders: before }), false),
  );
}

/** Opens the sign-in sheet (AccountButton listens), e.g. when a signed-out visitor reaches for a folder. */
export const askSignIn = () => dispatchEvent(new Event("tb:signin"));
