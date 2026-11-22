// The taste survey's cards (Survey.tsx), fetched when someone opens it, so no page's HTML carries them. Prerendered:
// serving it costs no Worker.
import type { APIRoute } from "astro";
import { kinds } from "../../../src/registry/schema.ts";
import { aesthetics, libraries } from "../lib/server.ts";
import type { SurveyData } from "../lib/survey.ts";

export const prerender = true;

// Six families far apart, so each swipe says something.
const LOOKS = ["minimal", "apple", "glass", "playful", "brutalist", "editorial"];

export const GET: APIRoute = () => {
  const known = new Set(libraries.map((l) => l.id));
  const looks = aesthetics
    .filter((a) => LOOKS.includes(a.id))
    // The kinds a look needs (glass for Glass) lead, so its defining library is asked about first.
    .map(({ id, name, summary, swatch: { layout: _, ...swatch }, picks, needs = [] }) => ({ id, name, summary, swatch, picks: [...new Set([...needs, ...kinds])].flatMap((k) => picks[k]?.find((p) => known.has(p)) ?? []) }));
  const ids = new Set(looks.flatMap((l) => l.picks));
  const libs = libraries.filter((l) => ids.has(l.id)).map(({ id, name, tagline }) => ({ id, name, tagline }));
  return Response.json({ looks, libs } satisfies SurveyData);
};
