// The registry contract. Every field exists to help an agent decide *whether* and *where* to use a library,
// not just what it is. Data files: src/registry/data/*.ts export `Library[]`; aesthetics: src/registry/aesthetics.ts.

export const kinds = [
  "component-kit", // styled, copy-in or installable component sets (shadcn/ui, Magic UI)
  "primitives", // unstyled, accessible building blocks (Base UI, Radix, React Aria)
  "motion", // animation engines and animated component sets (Motion, GSAP)
  "text-effects", // morphing, scrambling, number rolling (Torph, NumberFlow)
  "interaction", // drawers, carousels, gestures, drag (Vaul, Embla)
  "feedback", // toasts, progress, skeletons (Sonner)
  "command", // command palettes, search menus (cmdk)
  "icons", // static and animated icon sets
  "background", // shaders, gradients, patterns, particles
  "3d", // WebGL scenes and 3D helpers
  "charts", // data visualization
  "glass", // translucent material implementations (Glisse)
  "agent-ui", // chat, streaming, reasoning, tool-call UI
  "scroll", // smooth scroll, scroll-linked animation
] as const;

export const aestheticIds = [
  "minimal", // quiet, black or white, small type, few accents (Linear, Vercel)
  "apple", // springs, sheets, materials, SF-like type, physicality
  "glass", // translucency, refraction, layered depth
  "playful", // bouncy, colourful, rounded, stickers
  "brutalist", // raw, heavy type, hard edges, no polish on purpose
  "editorial", // magazine layouts, serif display, generous whitespace
  "retro", // pixel, terminal, dither, CRT, early web
  "neon", // dark with glowing saturated accents, cyber
  "corporate", // dense, trustworthy, enterprise dashboards
  "technical", // dev-tool, mono details, grids, data
  "luxury", // restrained, high contrast, slow elegant motion
  "organic", // soft shapes, natural colour, gentle motion
] as const;

export const frameworks = ["react", "vue", "svelte", "solid", "angular", "vanilla", "react-native"] as const;

export type Kind = (typeof kinds)[number];
export type AestheticId = (typeof aestheticIds)[number];
export type Framework = (typeof frameworks)[number];

export type Library = {
  /** Stable slug, usually the npm name without scope: "torph", "number-flow". */
  id: string;
  name: string;
  /** One line, plain words, what it is. */
  tagline: string;
  kind: Kind;
  /** Extra kinds it also covers, e.g. a kit that ships icons. */
  alsoCovers?: Kind[];
  frameworks: Framework[];
  /** How it is styled. "copy-in" means you own the source (shadcn-style registries). */
  styling: "tailwind" | "css" | "css-in-js" | "unstyled" | "copy-in";
  /** Aesthetics it fits well, best fit first. */
  aesthetic: AestheticId[];
  /** Concrete UI jobs it is the right pick for. Written as situations: "copy button that confirms in place". */
  useFor: string[];
  /** When an agent should NOT pick it, and what to do instead. */
  avoidWhen: string[];
  /** ids of libraries it combines well with. */
  pairsWith?: string[];
  /** ids of libraries that do the same job; the agent compares these. */
  alternatives?: string[];
  install: string;
  /** Minimal correct usage, real API, no placeholders. */
  usage: string;
  /** The agent note (prompt.md): how to use it well, defaults that matter, mistakes to avoid. 2-5 sentences. */
  note: string;
  /** Approximate client cost. */
  weight: "tiny" | "small" | "medium" | "large";
  a11y: "strong" | "ok" | "weak" | "n/a";
  maturity: "experimental" | "stable" | "established";
  /** What costs money, when anything does. Leave out for fully free libraries. */
  paid?: { what: string; price: string; url: string };
  /** Named parts it ships, as its docs name them: components for kits, styles for icons, chart types for charts. */
  parts?: { free: string[]; paid?: string[] };
  url: string;
  repo?: string;
  npm?: string;
  author: string;
  license: string;
  /**
   * Set when this entry is a feature of a larger package (React's <ViewTransition>, GSAP's SplitText). Its repo and
   * npm numbers belong to the parent, so trending skips it.
   */
  partOf?: string;
  /** Filled by the Worker's cron (src/trending.ts); leave out in data files. */
  stats?: { stars?: number; starsWeek?: number; downloadsWeek?: number; updatedAt?: string };
};

/** A look an agent can be asked for. Maps brief words to libraries and to concrete design decisions. */
export type Aesthetic = {
  id: AestheticId;
  name: string;
  summary: string;
  /** Words in a brief that point here: "liquid glass", "ios", "like linear". */
  signals: string[];
  /** Best library per kind for this look, in priority order. */
  picks: Partial<Record<Kind, string[]>>;
  type: string; // typefaces and how to set them
  colour: string; // palette rules
  motion: string; // easing, durations, what moves
  avoid: string[];
  references: { name: string; url: string }[];
};
