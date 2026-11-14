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
  "tables", // data tables and grids: sorting, filtering, virtual rows (TanStack Table)
  "editor", // rich text, block and code editors (Tiptap)
  "code", // syntax-highlighted code to read, not edit: samples, docs, snippets (Shiki)
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
  /** Install command for a framework whose package differs from `install` (lucide-react vs @lucide/vue). */
  installFor?: Partial<Record<Framework, string>>;
  /** Install command when a plan's base kit is the library with this id (BlockNote on shadcn-ui: @blocknote/shadcn). */
  installWith?: Record<string, string>;
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
  /**
   * A kit that is a look (98.css, GOV.UK Frontend, Konsta): plans use it only when the look picks it or the brief names
   * it. The registry index sets it for every entry in data/themed.ts; set it here for one that lives elsewhere.
   */
  themed?: true;
  /** A kit of parts for one domain (audio, documents) that sits on another kit: offered for its job, never an app's base. */
  addOn?: true;
  /** Filled by the Worker's cron (src/trending.ts); leave out in data files. */
  stats?: { stars?: number; starsWeek?: number; downloadsWeek?: number; updatedAt?: string };
};

/** How a look's specimen card renders on the site. Approximate on purpose: enough to taste the difference. */
export type Swatch = {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  radius: number;
  font: "sans" | "serif" | "mono" | "display" | "rounded" | "pixel" | "hand";
  /** Extra CSS declarations for the card when colour alone misses the look: shadows, borders, backdrop blur. */
  card?: string;
  /** Which specimen composition the site draws for this look; unset = "cards". */
  layout?:
    | "bento" | "columns" | "poster" | "steps" | "window" | "document" // composition
    | "diff" | "ticker" | "drawing" | "ascii" | "hud" | "prompt" | "table" | "ledger" | "mac" // look-alike data and windows
    | "frost" | "lens" | "extrude" | "clay" | "quiet" | "layers" | "inverse" | "blob" | "pigment" | "space" | "rough" // material and restraint
    | "confetti" | "cute" | "tonal" | "render" | "toon" | "warp" | "clash" | "sketch" // playful signatures
    | "float" | "veil" | "beam" | "horizon" | "glitch" | "foil" | "metal" | "hero" // light, depth and marketing
    | "panes" | "sheet" | "grouped" | "chunky" | "tube" | "maison" | "boutique" | "mesh" | "grain" | "tints" | "finish"
    | "night" | "gingham" | "flyout" | "paper" | "vitals" | "tiles" | "gel" | "sprite" | "bayer" | "rainbow" | "cutout"
    | "tape" | "flyer" | "loadout" // family roots and the rest
    | "raw" | "deco" | "kinetic" | "shapes" | "wedge" | "atomic" | "broken" | "overprint" | "comic" | "distressed" | "xerox"
    | "page" | "service" | "reference" | "homepage"; // poster and document looks, one each
};

type LookBase = {
  name: string;
  summary: string;
  /** How it differs from the looks it is most often confused with, naming them. */
  vs: string;
  swatch: Swatch;
  /** Words in a brief that point here: "liquid glass", "ios", "like linear". */
  signals: string[];
  /** Best library per kind for this look, in priority order. An empty list means no library: the look does it in CSS or not at all. */
  picks: Partial<Record<Kind, string[]>>;
  /** Kinds every plan in this look gets unasked (springs and sheets for apple). A style's list replaces its family's. */
  needs?: Kind[];
  type: string; // typefaces and how to set them
  colour: string; // palette rules
  motion: string; // easing, durations, what moves
  avoid: string[];
  references: { name: string; url: string }[];
};

/** One of the broad looks libraries are tagged with (`Library.aesthetic`). */
export type Family = LookBase & { id: AestheticId; family?: never };
/**
 * A named style inside a family (neo-brutalism in brutalist). Libraries are tagged with families only; a style's
 * `picks` override its family's per kind and its `needs` replace the family's; the registry index merges them, so the
 * engine sees full picks.
 */
export type Style = LookBase & { id: string; family: AestheticId };
/** A look an agent can be asked for. Maps brief words to libraries and to concrete design decisions. */
export type Aesthetic = Family | Style;

/**
 * What carries a whole page, orthogonal to its look: a 3D scene, scroll choreography, or photo and video. A luxury
 * site can be media-led and a technical one 3D. Detected from a brief like a look; shapes a plan's needs and picks.
 */
export type SiteType = {
  id: "3d-site" | "motion-site" | "media-site";
  name: string;
  signals: string[];
  /** Kinds this site always needs, added to a plan. */
  needs: Kind[];
  /** Kinds that fight this site (a shader behind a video); left out of its plans. */
  drops: Kind[];
  /** Best library per kind for this site, best first; these lead the plan for their kinds, whatever the look. */
  picks: Partial<Record<Kind, string[]>>;
  /** How to build it: structure and the performance rules that keep it fast. */
  build: string;
  avoid: string[];
};
