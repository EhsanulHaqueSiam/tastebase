// Client-safe: every section of the site, in rail order. The desktop rail (Rail.tsx) shows them all; the phone tab bar
// (TabBar.tsx) shows the `tab` ones and puts the rest in its More sheet, so every section is reachable everywhere.
import { useEffect, useRef, useState, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { BlocksIcon } from "../components/icons/blocks.tsx";
import { BookTextIcon } from "../components/icons/book-text.tsx";
import { CompassIcon } from "../components/icons/compass.tsx";
import { FoldersIcon } from "../components/icons/folders.tsx";
import { GitPullRequestIcon } from "../components/icons/git-pull-request.tsx";
import { HomeIcon } from "../components/icons/home.tsx";
import { LayersIcon } from "../components/icons/layers.tsx";
import { LayoutGridIcon } from "../components/icons/layout-grid.tsx";
import { PaletteIcon } from "../components/icons/palette.tsx";
import { PlugZapIcon } from "../components/icons/plug-zap.tsx";
import { ScanTextIcon } from "../components/icons/scan-text.tsx";
import { SparklesIcon } from "../components/icons/sparkles.tsx";
import { TerminalIcon } from "../components/icons/terminal.tsx";
import { categories } from "./categories.ts";

/** A lucide-animated icon: it plays on its own hover, or when a parent holding its ref calls start/stop. */
export type IconHandle = { startAnimation: () => void; stopAnimation: () => void };
export type AnimatedIcon = ForwardRefExoticComponent<{ size?: number; className?: string } & RefAttributes<IconHandle>>;

/** `also`: other paths that belong to the section (every category page belongs to Resources). */
export type Section = { href: string; label: string; icon: AnimatedIcon; tab?: boolean; also?: readonly string[] };

export const sections: Section[] = [
  { href: "/", label: "Home", icon: HomeIcon, tab: true },
  { href: "/browse", label: "Browse", icon: LayoutGridIcon, tab: true },
  { href: "/components", label: "Components", icon: BlocksIcon, tab: true },
  { href: "/tools", label: "Resources", icon: LayersIcon, also: categories.map((c) => `/${c.slug}`) },
  { href: "/best", label: "Articles", icon: BookTextIcon, also: ["/alternatives"] },
  { href: "/folders", label: "Folders", icon: FoldersIcon },
  { href: "/match", label: "Match a screenshot", icon: ScanTextIcon },
  { href: "/looks", label: "Looks", icon: PaletteIcon },
  { href: "/atlas", label: "Atlas", icon: CompassIcon },
  { href: "/integrations", label: "Integrations", icon: PlugZapIcon },
  { href: "/#plan", label: "Plan", icon: SparklesIcon },
  { href: "/#mcp", label: "Set up MCP", icon: TerminalIcon },
  { href: "/contribute", label: "Contribute", icon: GitPullRequestIcon, also: ["/submit", "/feedback", "/sponsor", "/about", "/terms"] },
];

/** Whether a path is in a section: Home only on "/", hash links never (they are places on Home, not pages). */
export const isCurrent = ({ href, also = [] }: Pick<Section, "href" | "also">, path: string) =>
  href === "/" ? path === "/" : !href.includes("#") && [href, ...also].some((p) => path === p || path.startsWith(`${p}/`));

/** The current path for navigation that persists across client navigations (Rail, TabBar). */
export function usePath(initial = "") {
  const [path, setPath] = useState(initial);
  useEffect(() => {
    const sync = () => setPath(location.pathname);
    sync();
    document.addEventListener("astro:page-load", sync);
    return () => document.removeEventListener("astro:page-load", sync);
  }, []);
  return path;
}

/** Lets a whole row or button play its icon, not only the 18px glyph: spread `on` onto the parent, pass `ref` to the icon. */
export function useIconHover() {
  const ref = useRef<IconHandle>(null);
  const start = () => ref.current?.startAnimation();
  const stop = () => ref.current?.stopAnimation();
  return { ref, on: { onPointerEnter: start, onPointerLeave: stop, onFocus: start, onBlur: stop } };
}

