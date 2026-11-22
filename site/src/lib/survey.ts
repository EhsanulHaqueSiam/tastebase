// Client-safe: the taste survey's cards (served as /survey.json, read by Survey.tsx) and which libraries follow the
// looks a person liked. No registry import, so the survey's chunk stays small.
import type { Swatch } from "../../../src/registry/schema.ts";

/** A look card: drawn from its swatch, like the specimens on /looks. `picks` is its best library per kind, in kind order. */
export type SurveyLook = { id: string; name: string; summary: string; swatch: Swatch; picks: string[] };
export type SurveyLib = { id: string; name: string; tagline: string };
export type SurveyData = { looks: SurveyLook[]; libs: SurveyLib[] };

/** Set once the survey is finished or its home banner dismissed; the banner never shows again. */
export const SURVEY_KEY = "tastebase:survey";

/** Up to `n` library ids for the looks liked: their picks taken in turns, so every liked look gets a say. Nothing
 *  liked: the same over every look, so the library half still asks about something. */
export function follow(looks: SurveyLook[], liked: string[], n: number) {
  const from = looks.filter((l) => liked.includes(l.id));
  const lists = (from.length ? from : looks).map((l) => l.picks);
  const out = new Set<string>();
  for (let i = 0; out.size < n && lists.some((p) => i < p.length); i++)
    for (const p of lists) {
      const id = p[i];
      if (id && out.size < n) out.add(id);
    }
  return [...out];
}
