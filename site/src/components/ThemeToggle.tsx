// Dark/light switch for the header and the detail pill: the sun shows in dark (tap for light), the moon in light.
import { haptic } from "../lib/haptics.ts";
import { useIconHover } from "../lib/nav.ts";
import { setTheme, useTheme } from "../lib/theme.ts";
import { IconMorph } from "./fx.tsx";
import { MoonIcon } from "./icons/moon.tsx";
import { SunIcon } from "./icons/sun.tsx";

export default function ThemeToggle({ className = "", size = 18 }: { className?: string; size?: number }) {
  const theme = useTheme();
  const { ref, on } = useIconHover();
  const Icon = theme === "dark" ? SunIcon : MoonIcon;
  return (
    <button
      type="button"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      data-sound="toggle"
      onClick={() => (haptic("selection"), setTheme(theme === "dark" ? "light" : "dark"))}
      {...on}
      className={`press grid place-items-center text-fg2 hover:text-fg ${className}`}
    >
      <IconMorph k={theme}>
        <Icon ref={ref} size={size} className="grid place-items-center" />
      </IconMorph>
    </button>
  );
}
