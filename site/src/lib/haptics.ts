// Client-side: haptic taps on phones through web-haptics (Android's vibrate, iOS through a hidden switch it clicks).
// Touch screens only: on a mouse there is nothing to feel, and the iOS path would spin a frame loop for nothing.
import { WebHaptics } from "web-haptics";

type Preset = "selection" | "light" | "success";
let h: WebHaptics | undefined;

// The iOS switch lives in <body>, which every client-side navigation replaces, so start a fresh one after each swap.
if (typeof document !== "undefined") document.addEventListener("astro:after-swap", () => (h?.destroy(), (h = undefined)));

export function haptic(preset: Preset) {
  if (!matchMedia("(pointer: coarse)").matches) return;
  (h ??= new WebHaptics()).trigger(preset).catch(() => {});
}
