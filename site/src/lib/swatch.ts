// Client-safe: drawing a look from its swatch (the taste survey's cards, the dashboard's look picker, /looks/<id>).
import type { CSSProperties } from "react";
import type { Swatch } from "../../../src/registry/schema.ts";

export const FONTS: Record<Swatch["font"], CSSProperties> = {
  sans: { fontFamily: "var(--font-sans)", fontWeight: 600 },
  serif: { fontFamily: 'ui-serif, "Iowan Old Style", Palatino, Georgia, serif', fontWeight: 600 },
  mono: { fontFamily: "var(--font-mono)", fontWeight: 500 },
  display: { fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif', fontWeight: 900, letterSpacing: "-0.02em" },
  rounded: { fontFamily: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", var(--font-sans)', fontWeight: 700 },
  pixel: { fontFamily: "Silkscreen, var(--font-mono)" },
  hand: { fontFamily: 'Caveat, "Bradley Hand", cursive', fontWeight: 600 },
};

// A swatch's `card` declarations ("border:2px solid #000;box-shadow:...") as a React style.
export const declarations = (css = ""): CSSProperties =>
  Object.fromEntries(css.split(";").filter((s) => s.includes(":")).map((s) => [s.slice(0, s.indexOf(":")).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), s.slice(s.indexOf(":") + 1).trim()]));

// Text on the accent: near-black on light accents, white on dark ones (the threshold /looks uses).
export const ink = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.19 ? "#111" : "#fff";
};

