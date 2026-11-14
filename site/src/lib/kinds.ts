// Client-safe: labels, icons and colours per kind. No registry import, so islands stay small.
import { Bell, Box, Boxes, Code, Command, Gem, Image, Layers, LineChart, MessageSquare, MousePointerClick, PenLine, ScrollText, Shapes, Sparkles, Table, Type, type LucideIcon } from "lucide-react";
import type { Kind } from "../../../src/registry/schema.ts";

export const kindMeta: Record<Kind, { label: string; short: string; icon: LucideIcon; color: string }> = {
  "component-kit": { label: "Component kits", short: "Kit", icon: Boxes, color: "var(--color-blue)" },
  primitives: { label: "Primitives", short: "Primitives", icon: Box, color: "var(--color-fg)" },
  motion: { label: "Motion", short: "Motion", icon: Sparkles, color: "var(--color-amber)" },
  "text-effects": { label: "Text effects", short: "Text", icon: Type, color: "var(--color-pink)" },
  interaction: { label: "Interaction", short: "Interaction", icon: MousePointerClick, color: "var(--color-green)" },
  feedback: { label: "Feedback", short: "Feedback", icon: Bell, color: "var(--color-amber)" },
  command: { label: "Command menus", short: "Command", icon: Command, color: "var(--color-fg)" },
  icons: { label: "Icons", short: "Icons", icon: Shapes, color: "var(--color-violet)" },
  background: { label: "Backgrounds", short: "Background", icon: Image, color: "var(--color-cyan)" },
  "3d": { label: "3D", short: "3D", icon: Layers, color: "var(--color-violet)" },
  charts: { label: "Charts", short: "Charts", icon: LineChart, color: "var(--color-green)" },
  glass: { label: "Glass", short: "Glass", icon: Gem, color: "var(--color-cyan)" },
  "agent-ui": { label: "Agent UI", short: "Agent UI", icon: MessageSquare, color: "var(--color-blue)" },
  scroll: { label: "Scroll", short: "Scroll", icon: ScrollText, color: "var(--color-pink)" },
  tables: { label: "Tables", short: "Tables", icon: Table, color: "var(--color-green)" },
  editor: { label: "Editors", short: "Editor", icon: PenLine, color: "var(--color-violet)" },
  code: { label: "Code blocks", short: "Code", icon: Code, color: "var(--color-cyan)" },
};

export const shot = (id: string) => `/shots/${id}.webp`;
