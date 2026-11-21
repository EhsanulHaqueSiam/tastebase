// Client-side: interface sound cues (cuelume), off by default. Switched on, cuelume loads and binds the data-cuelume-*
// attributes in the markup (tap, navigate, toggle); search plays "ready" through cue(). prefers-reduced-motion keeps
// every cue silent. The choice lives in localStorage; nothing loads for a visitor who never switches it on.
import type { SoundName } from "cuelume";
import { useSyncExternalStore } from "react";

const KEY = "tb-sound";
const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const stored = () => {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
};

let engine: Promise<typeof import("cuelume")> | undefined;
// bind() delegates from the document, so it survives client navigations; it is safe to call once per page load.
const load = () => (engine ??= import("cuelume").then((c) => (c.bind(), c.setEnabled(!quiet()), c)));

const subscribe = (fn: () => void) => (addEventListener("tb:sound", fn), () => removeEventListener("tb:sound", fn));
export const useSound = () => useSyncExternalStore(subscribe, stored, () => false);

/** Base.astro: loads the cues on each full page load when this browser switched them on. */
export const startSound = () => void (stored() && load());

export async function setSound(on: boolean) {
  try {
    on ? localStorage.setItem(KEY, "on") : localStorage.removeItem(KEY);
  } catch {} // private mode: on for this page only
  dispatchEvent(new Event("tb:sound"));
  if (!on) return void engine?.then((c) => c.setEnabled(false));
  const c = await load();
  c.setEnabled(!quiet());
  await c.unlock(); // from the click that switched it on: some browsers only start audio inside a gesture
  c.play("toggle");
}

/** A cue from code, for moments no click marks (search results arriving). */
export const cue = (name: SoundName) => void (stored() && load().then((c) => c.play(name, { emphasis: "subtle" })));
