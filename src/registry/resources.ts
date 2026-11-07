// Design resources: not installed, but they help an agent or a person design. tastebase only links to them and never
// calls them with anyone's account. `mcp` is a server the user can connect under their own account; when the agent
// has it, plan answers say what to search for. Verified on 2026-11-08.

export type Resource = {
  id: string;
  name: string;
  url: string;
  kind: "references" | "fonts" | "colour" | "assets";
  goodFor: string;
  cost: string;
  /** Usable for real without paying. */
  free: boolean;
  mcp?: { name: string; url: string; needsPaidPlan: boolean };
};

export const resources: Resource[] = [
  {
    id: "inspo",
    name: "Inspo",
    url: "https://inspomcp.dev",
    kind: "references",
    goodFor: "Real production landing pages with palettes, fonts and page structure",
    cost: "Free, open source",
    free: true,
    mcp: { name: "Inspo MCP", url: "https://inspomcp.dev/mcp", needsPaidPlan: false },
  },
  {
    id: "mobbin",
    name: "Mobbin",
    url: "https://mobbin.com",
    kind: "references",
    goodFor: "Screens, flows and site sections from shipped iOS and web products",
    cost: "Free tier without search; Pro $10/mo yearly",
    free: false,
    mcp: { name: "Mobbin MCP", url: "https://docs.mobbin.com/mcp/clients/overview", needsPaidPlan: true },
  },
  {
    id: "refero",
    name: "Refero",
    url: "https://refero.design",
    kind: "references",
    goodFor: "Product screens and flows tagged by pattern: checkout, empty state, settings",
    cost: "Small free preview; Pro $10/mo yearly",
    free: false,
    mcp: { name: "Refero MCP", url: "https://doc.refero.design/help/plans", needsPaidPlan: true },
  },
  {
    id: "recent",
    name: "Recent (formerly Godly)",
    url: "https://recent.design",
    kind: "references",
    goodFor: "Daily curated web, interface and motion design",
    cost: "Free",
    free: true,
  },
  {
    id: "dark-design",
    name: "Dark Design",
    url: "https://www.dark.design",
    kind: "references",
    goodFor: "Hand-picked dark websites, filterable by industry",
    cost: "Free to browse",
    free: true,
  },
  {
    id: "fontshare",
    name: "Fontshare",
    url: "https://www.fontshare.com",
    kind: "fonts",
    goodFor: "Quality free fonts (Satoshi, General Sans, Clash Display) with pairings",
    cost: "Free, commercial use too",
    free: true,
  },
  {
    id: "google-fonts",
    name: "Google Fonts",
    url: "https://fonts.google.com",
    kind: "fonts",
    goodFor: "The largest open-licence font library, variable fonts included",
    cost: "Free",
    free: true,
    mcp: { name: "Google Design MCP", url: "https://developers.google.com/design-mcp/overview", needsPaidPlan: false },
  },
  {
    id: "uncut",
    name: "Uncut",
    url: "https://uncut.wtf",
    kind: "fonts",
    goodFor: "Contemporary free typefaces for a less default look",
    cost: "Free, commercial use too",
    free: true,
  },
  {
    id: "realtime-colors",
    name: "Realtime Colors",
    url: "https://www.realtimecolors.com",
    kind: "colour",
    goodFor: "Try a palette and fonts on a real page, export CSS or Tailwind",
    cost: "Free",
    free: true,
  },
  {
    id: "coolors",
    name: "Coolors",
    url: "https://coolors.co",
    kind: "colour",
    goodFor: "Fast palette generator and a browsable palette library",
    cost: "Free with ads; Pro $3/mo yearly",
    free: true,
  },
  {
    id: "huemint",
    name: "Huemint",
    url: "https://huemint.com",
    kind: "colour",
    goodFor: "Palettes generated for a specific layout, with contrast control",
    cost: "Free",
    free: true,
  },
  {
    id: "haikei",
    name: "Haikei",
    url: "https://haikei.app",
    kind: "assets",
    goodFor: "SVG backgrounds and shapes: blobs, waves, layered peaks, gradients",
    cost: "Free, no signup",
    free: true,
  },
];
