// Client-side: saved library ids in localStorage, shared by every island on the page and synced across tabs.
import { useSyncExternalStore } from "react";

const KEY = "tastebase:saved";
const EMPTY: string[] = [];
const subs = new Set<() => void>();
let cache: string[] | undefined;

// Storage can throw (private mode, blocked site data) or hold junk; either way the list starts empty.
function read(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const snapshot = () => (cache ??= read());

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && ((cache = undefined), cb());
  subs.add(cb);
  addEventListener("storage", onStorage);
  return () => (subs.delete(cb), removeEventListener("storage", onStorage));
}

/** Saved ids, oldest first. Empty on the server and on the first client render, so hydration matches. */
export const useSaved = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);

export function toggleSaved(id: string) {
  const cur = snapshot();
  cache = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  subs.forEach((f) => f());
}
