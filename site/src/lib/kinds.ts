// Client-safe: labels, icons and colours per kind. No registry import, so islands stay small.
import { Bell, Box, Boxes, Command, Gem, Image, Layers, LineChart, MessageSquare, MousePointerClick, ScrollText, Shapes, Sparkles, Type, type LucideIcon } from "lucide-react";
import type { Kind } from "../../../src/registry/schema.ts";

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

export const shot = (id: string) => `/shots/${id}.webp`;
