// Client-side: interface sound cues, off by default. Each cue is one quiet sine note that eases in, glides a little and
// fades within a tenth of a second (after ehsanulhaquesiam.netlify.app); notes come from C major pentatonic, so any run of
// them sounds musical. Elements opt in with data-sound="<cue>" (typing: keys pressed in the field); code plays cue().
// prefers-reduced-motion keeps every cue silent. The choice lives in localStorage; no audio starts until it is on.
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

let ctx: AudioContext | undefined;
/** The running context, created and resumed on demand; cues are only ever played from a gesture or after one. */
const audio = () => {
  if (!stored() || quiet() || typeof AudioContext === "undefined") return;
  ctx ??= new AudioContext();
  if (ctx.state !== "running") void ctx.resume();
  return ctx;
};

/** One sine note: 5ms in (no click), then an exponential fade over `dur` while the pitch glides to `freq * glide`. */
function tone(freq: number, dur: number, gain: number, glide = 0.8) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noise: AudioBuffer | undefined;
/** Air moving: soft noise through a band that sweeps up, for going to another page. */
function whoosh() {
  const a = audio();
  if (!a) return;
  if (!noise) {
    noise = a.createBuffer(1, Math.ceil(a.sampleRate * 0.4), a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noise;
  f.type = "bandpass";
  f.Q.value = 0.9;
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(2000, t + 0.35);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.035, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  s.connect(f).connect(g).connect(a.destination);
  s.start(t);
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
let step = 0, lastSelect = 0, lastKey = 0;
const cues = {
  tap: () => tone(640, 0.06, 0.06, 0.75),
  // Picks in a row walk up the scale; a pause starts it again.
  select: () => {
    const now = performance.now();
    if (now - lastSelect > 1200) step = 0;
    lastSelect = now;
    tone(PENTA[step++ % PENTA.length]!, 0.09, 0.05, 0.9);
  },
  toggle: () => tone(760, 0.07, 0.05, 1.25),
  close: () => tone(560, 0.07, 0.05, 0.8),
  navigate: whoosh,
  type: () => {
    const now = performance.now();
    if (now - lastKey < 45) return;
    lastKey = now;
    tone(1000, 0.04, 0.03, 0.9);
  },
  ready: () => tone(1046.5, 0.14, 0.05, 1),
  warning: () => tone(440, 0.14, 0.05, 0.9),
} as const;
export type Cue = keyof typeof cues;
const isCue = (c: string | null | undefined): c is Cue => !!c && c in cues;

const subscribe = (fn: () => void) => (addEventListener("tb:sound", fn), () => removeEventListener("tb:sound", fn));
export const useSound = () => useSyncExternalStore(subscribe, stored, () => false);

/** Base.astro, once per full page load: one delegated listener per event, so client navigations keep working. */
export function startSound() {
  document.addEventListener("click", (e) => {
    const c = (e.target as Element).closest?.("[data-sound]")?.getAttribute("data-sound");
    if (isCue(c) && c !== "type") cues[c]();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key.length === 1 || e.key === "Backspace") && (e.target as Element).closest?.('[data-sound="type"]')) cues.type();
  });
}

export function setSound(on: boolean) {
  try {
    on ? localStorage.setItem(KEY, "on") : localStorage.removeItem(KEY);
  } catch {} // storage blocked (private mode): sound stays off
  dispatchEvent(new Event("tb:sound"));
  if (on) cues.toggle(); // from the click that switched it on, so the browser lets audio start
}

/** A cue from code, for moments no click marks (search results arriving). */
export const cue = (name: Cue) => cues[name]();
