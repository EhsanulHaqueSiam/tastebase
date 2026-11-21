// Sound on/off, next to the theme toggle. Off by default; see lib/sound.ts.
import { Volume2, VolumeX } from "lucide-react";
import { haptic } from "../lib/haptics.ts";
import { setSound, useSound } from "../lib/sound.ts";
import { IconMorph } from "./fx.tsx";

export default function SoundToggle({ className = "", size = 17 }: { className?: string; size?: number }) {
  const on = useSound();
  const Icon = on ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      aria-label={on ? "Turn interface sounds off" : "Turn interface sounds on"}
      aria-pressed={on}
      title={on ? "Sounds on" : "Sounds off"}
      onClick={() => (haptic("selection"), void setSound(!on))}
      className={`press grid place-items-center text-fg2 hover:text-fg ${className}`}
    >
      <IconMorph k={on ? "on" : "off"}>
        <Icon size={size} aria-hidden />
      </IconMorph>
    </button>
  );
}
