// The site reads the same registry and engine the MCP server uses, so what you see is what the agent gets.
import { Box, Boxes, Command, Gem, Image, Layers, LineChart, MessageSquare, MousePointerClick, Bell, ScrollText, Shapes, Sparkles, Type, type LucideIcon } from "lucide-react";
import { aesthetics, libraries } from "../../src/registry/index.ts";
import type { Kind, Library } from "../../src/registry/schema.ts";

export { aesthetics, libraries };
export type { Library, Kind };

export const kindMeta: Record<Kind, { label: string; icon: LucideIcon; color: string }> = {
  "component-kit": { label: "Component kits", icon: Boxes, color: "var(--color-blue)" },
  primitives: { label: "Primitives", icon: Box, color: "var(--color-fg)" },
  motion: { label: "Motion", icon: Sparkles, color: "var(--color-amber)" },
  "text-effects": { label: "Text effects", icon: Type, color: "var(--color-pink)" },
  interaction: { label: "Interaction", icon: MousePointerClick, color: "var(--color-green)" },
  feedback: { label: "Feedback", icon: Bell, color: "var(--color-amber)" },
  command: { label: "Command menus", icon: Command, color: "var(--color-fg)" },
  icons: { label: "Icons", icon: Shapes, color: "var(--color-violet)" },
  background: { label: "Backgrounds", icon: Image, color: "var(--color-cyan)" },
  "3d": { label: "3D", icon: Layers, color: "var(--color-violet)" },
  charts: { label: "Charts", icon: LineChart, color: "var(--color-green)" },
  glass: { label: "Glass", icon: Gem, color: "var(--color-cyan)" },
  "agent-ui": { label: "Agent UI", icon: MessageSquare, color: "var(--color-blue)" },
  scroll: { label: "Scroll", icon: ScrollText, color: "var(--color-pink)" },
};

export const byId = new Map(libraries.map((l) => [l.id, l]));
export const shot = (id: string) => `/shots/${id}.webp`;
export const isHot = (l: Library) => (l.stats?.starsWeek ?? 0) >= 150;
export const isNew = (l: Library) => l.maturity === "experimental";
