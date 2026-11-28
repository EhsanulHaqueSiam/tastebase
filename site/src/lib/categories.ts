// Client-safe: the resource categories the site lists at /<slug>, and which registry entries fill each one. A category
// takes libraries by kind and resources by resource kind; a resource kind the registry does not have yet simply adds
// nothing, so a category fills in when its entries land.
import type { Kind } from "../../../src/registry/schema.ts";

export type Category = { slug: string; label: string; blurb: string; kinds?: readonly Kind[]; resources: readonly string[] };

export const categories = [
  { slug: "tools", label: "Tools", blurb: "Skills, generators and utilities that help you or your coding agent design: DESIGN.md makers, wireframes, shader editors and review tools.", resources: ["agent-tools", "tools"] },
  { slug: "mockups", label: "Mockups", blurb: "Device frames, product renders and scenes to show a finished design in context.", resources: ["mockups"] },
  { slug: "icons", label: "Icons", blurb: "Static and animated icon sets you install, plus 3D icon renders for hero art.", kinds: ["icons"], resources: ["icons"] },
  { slug: "fonts", label: "Fonts", blurb: "Typefaces that are free to use, including for commercial work, for a less default look.", resources: ["fonts"] },
  { slug: "colours", label: "Colours", blurb: "Palette generators and scales you can try on a real page before you commit.", resources: ["colour"] },
  { slug: "illustrations", label: "Illustrations", blurb: "Illustrations, 3D renders, photos and backgrounds, free or openly licensed.", resources: ["illustrations", "assets"] },
  { slug: "ui", label: "UI", blurb: "Component kits and primitives to build with, galleries of real parts, and directories of community components.", kinds: ["component-kit", "primitives"], resources: ["parts", "directories"] },
  { slug: "inspiration", label: "Inspiration", blurb: "Real shipped sites, apps and motion to study before you design, and the DESIGN.md files behind them.", resources: ["references", "inspiration"] },
  { slug: "finds", label: "Finds", blurb: "Single pieces of motion and interface work posted by designers and developers, with the technique behind each.", resources: ["finds"] },
  { slug: "portfolios", label: "Portfolios", blurb: "Designers', design engineers' and studios' own sites, to study for layout, type, motion and case studies.", resources: ["portfolios"] },
  { slug: "reading", label: "Reading", blurb: "Essays, blogs and books on interface craft, motion and design engineering.", resources: ["reading"] },
] as const satisfies readonly Category[];

export type CategorySlug = (typeof categories)[number]["slug"];
export type Pricing = "free" | "paid" | "freemium";

/** One card in a category grid, "Recently added" or "Try these": a library or a resource. */
export type Listing = {
  id: string;
  name: string;
  description: string;
  /** The site itself. */
  url: string;
  /** What the live preview opens, when not `url`: a library's demo page. */
  demo?: string;
  /** Our detail page. */
  href: string;
  image: string;
  pricing: Pricing;
  addedAt?: string;
  /** Category slug, or "browse" for a library outside every category. */
  category: string;
  /** Up to five hex colours of its design (designeer's palette), shown as a strip under the screenshot. */
  palette?: string[];
  /** A short muted preview clip (/videos/<id>.mp4) that plays while the card is hovered. */
  video?: string;
  /** ISO date the site was found down: the card greys out and says so. */
  down?: string;
};
