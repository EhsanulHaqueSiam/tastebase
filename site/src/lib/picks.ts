// Client-side: the site owner's editor's picks (id -> one-line reason), shared by every island on the page. The first
// island that reads them fetches GET /api/picks once per page load; admins change them from a detail page (PickToggle).
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { EditorPick } from "./auth-data.ts";

const EMPTY = new Map<string, string>();
const subs = new Set<() => void>();
let picks = EMPTY;
let pending: Promise<void> | undefined;

const set = (next: Map<string, string>) => ((picks = next), subs.forEach((f) => f()));

function subscribe(cb: () => void) {
  pending ??= fetch("/api/picks")
    .then((r) => (r.ok ? (r.json() as Promise<{ picks: EditorPick[] }>) : { picks: [] }))
    .then((b) => set(new Map(b.picks.map((p) => [p.id, p.reason]))), () => {});
  subs.add(cb);
  return () => void subs.delete(cb);
}

/** Every editor's pick, newest first. Empty on the server and the first client render, so hydration matches. */
export const useEditorPicks = () => useSyncExternalStore(subscribe, () => picks, () => EMPTY);
/** This item's reason when it is an editor's pick. */
export const useEditorPick = (id: string) => useEditorPicks().get(id);

/** Picks an item with a reason, or unpicks it (`reason` null). Optimistic; undone with a toast when the server refuses. */
export async function setEditorPick(id: string, reason: string | null) {
  const before = picks;
  const next = new Map(picks);
  if (reason === null) next.delete(id);
  else next.set(id, reason);
  set(next);
  const r = await fetch("/api/picks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item: id, on: reason !== null, reason }) }).catch(() => null);
  if (r?.ok) return;
  set(before);
  const out = (await r?.json().catch(() => null)) as { error?: string } | null;
  toast.error(out?.error ?? "Could not save the pick.");
}
