// Pages asked for the way a person would. A few name their look; most only imply it through the product, so the
// build without tastebase has to guess it too. Two name none and are about using the right libraries. A brief is data: what was asked, and how to tell it was built.
import type { AestheticId, Kind } from "../../src/registry/schema.ts";

export type Brief = {
  id: string;
  brief: string;
  /** The look the page must read as, judged from the screenshots alone. */
  look?: AestheticId;
  /** The engine does not read this look from the brief, so the agent has to infer it and pass it. */
  implied?: true;
  /** Kinds of library the brief's features call for: every job it asks for that a library does better than hand-written
   * code (a gallery, a code sample, a celebration). The page must use one tastebase offered for each. */
  needs?: Kind[];
  /** What the page must contain to be what was asked for: a pattern in its text, or a CSS selector. */
  has?: Record<string, RegExp | string>;
  /** Text of a control that must open something when pressed. */
  click?: string;
  /** The look's rules in src/registry/aesthetics.ts that state a number the page probe can count. */
  limits?: { accents?: number; loops?: number };
};

const chart = "svg, canvas", table = 'table, [role="table"], [role="grid"]';

export const briefs: Brief[] = [
  { id: "minimal", look: "minimal", brief: "Pricing page for Tally, an invoicing tool for freelancers: three plans and an FAQ. Quiet and clean, like Linear.", has: { "three prices": /(\$\s?\d[\s\S]*){3}/, "an FAQ": /faq|questions/ }, limits: { accents: 1, loops: 0 } },
  { id: "apple", look: "apple", brief: "Home screen for Stride, a habit tracker: today's habits, a weekly streak, and a bottom sheet to add a habit. It should feel like a native iOS app.", needs: ["interaction"], has: { "the streak": /streak/ }, click: "add|new" },
  { id: "glass", look: "glass", brief: "Now-playing screen for a music player in the visionOS style: frosted, translucent panels over the album art.", has: { "playback controls": "button" } },
  { id: "playful", look: "playful", brief: "Lesson-complete screen for a kids' spelling game: the stars earned, the streak, and a button to start the next lesson.", needs: ["feedback"], has: { "a way to the next lesson": /next|continue|start lesson/ } },
  { id: "brutalist", look: "brutalist", brief: "Landing page for a type foundry's new typeface. Brutalist: raw, heavy type, hard edges.", limits: { accents: 1 } },
  { id: "editorial", look: "editorial", brief: "Article page for a long read about post-war housing in an online architecture magazine.", has: { "a long article": /[\s\S]{1500}/ } },
  { id: "retro", look: "retro", brief: "Leaderboard for a pixel-art arcade game.", has: { "a ranked list": `ol, li, ${table}` } },
  { id: "neon", look: "neon", brief: "Landing page for a cyberpunk racing game.", limits: { accents: 2 } },
  { id: "corporate", look: "corporate", brief: "Admin dashboard for a logistics company: a KPI row, a shipments table and one chart.", needs: ["charts", "tables"], has: { "a table": table, "a chart": chart }, limits: { loops: 0 } },
  { id: "technical", look: "technical", brief: "Landing page for Relay, an email API for developers, with a code sample.", needs: ["code"], has: { "a code sample": "pre, code" } },
  { id: "luxury", look: "luxury", brief: "Product page for a fine jewellery house's new ring collection.", needs: ["interaction"], limits: { accents: 1 } },
  { id: "organic", look: "organic", brief: "Home screen for a meditation app with a breathing exercise.", needs: ["motion"] },
  // No look asked for: these are about reaching for the right library for each job.
  { id: "podcast-analytics", brief: "Stats page for a podcast host: downloads over time as a chart, the top episodes, a command menu on cmd+k to jump between shows, and a toast when a report is exported.", needs: ["charts", "command", "feedback"], has: { "a chart": chart }, click: "export" },
  { id: "support-chat", brief: "Support chat for a bank's app: an assistant that streams its answers, suggested first questions, and a thumbs up or down on each answer.", needs: ["agent-ui"], has: { "a message box": "textarea, input" } },
];
