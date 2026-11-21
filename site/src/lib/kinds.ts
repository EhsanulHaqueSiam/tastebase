// Client-safe: labels, icons and colours per kind. No registry import, so islands stay small.
import { Bell, Box, Boxes, Code, Command, Gem, Image, Layers, LineChart, MessageSquare, MousePointerClick, PenLine, ScrollText, Shapes, Sparkles, Table, Type, type LucideIcon } from "lucide-react";
import type { Kind } from "../../../src/registry/schema.ts";

/** One-shot hover motion for an icon (`[data-anim]` in styles.css), in the lucide-animated style. */
export type Anim = "spin" | "ring" | "pop" | "drop" | "nudge" | "draw";

export const kindMeta: Record<Kind, { label: string; short: string; icon: LucideIcon; color: string; anim: Anim }> = {
  "component-kit": { label: "Component kits", short: "Kit", icon: Boxes, color: "var(--color-blue)", anim: "drop" },
  primitives: { label: "Primitives", short: "Primitives", icon: Box, color: "var(--color-fg)", anim: "pop" },
  motion: { label: "Motion", short: "Motion", icon: Sparkles, color: "var(--color-amber)", anim: "spin" },
  "text-effects": { label: "Text effects", short: "Text", icon: Type, color: "var(--color-pink)", anim: "drop" },
  interaction: { label: "Interaction", short: "Interaction", icon: MousePointerClick, color: "var(--color-green)", anim: "nudge" },
  feedback: { label: "Feedback", short: "Feedback", icon: Bell, color: "var(--color-amber)", anim: "ring" },
  command: { label: "Command menus", short: "Command", icon: Command, color: "var(--color-fg)", anim: "pop" },
  icons: { label: "Icons", short: "Icons", icon: Shapes, color: "var(--color-violet)", anim: "pop" },
  background: { label: "Backgrounds", short: "Background", icon: Image, color: "var(--color-cyan)", anim: "nudge" },
  "3d": { label: "3D", short: "3D", icon: Layers, color: "var(--color-violet)", anim: "drop" },
  charts: { label: "Charts", short: "Charts", icon: LineChart, color: "var(--color-green)", anim: "draw" },
  glass: { label: "Glass", short: "Glass", icon: Gem, color: "var(--color-cyan)", anim: "pop" },
  "agent-ui": { label: "Agent UI", short: "Agent UI", icon: MessageSquare, color: "var(--color-blue)", anim: "ring" },
  scroll: { label: "Scroll", short: "Scroll", icon: ScrollText, color: "var(--color-pink)", anim: "nudge" },
  tables: { label: "Tables", short: "Tables", icon: Table, color: "var(--color-green)", anim: "pop" },
  editor: { label: "Editors", short: "Editor", icon: PenLine, color: "var(--color-violet)", anim: "ring" },
  code: { label: "Code blocks", short: "Code", icon: Code, color: "var(--color-cyan)", anim: "nudge" },
};

export const shot = (id: string) => `/shots/${id}.webp`;
