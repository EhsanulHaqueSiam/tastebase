import { defaultFilter } from "cmdk";
import { stems } from "../../../src/words.ts";

type Searchable = { name: string; text: string };

// A text's stemmed content words, parsed once: registry text does not change while the page or the Worker lives.
const parsed = new Map<string, Set<string>>();
const wordsIn = (text: string) => parsed.get(text) ?? parsed.set(text, new Set(stems(text))).get(text)!;

/**
 * The share of a query's content words ("toast that stacks and swipes away": toast, stack, swipe, away) a text names
 * as whole words, once it names enough of them: all of one or two, 60% of more. 0 below that, or when the query is
 * only stop words. `typing` lets the last word match the start of a word, for a box that searches as you type.
 */
export function wordShare(q: string, text: string, typing = false) {
  const ws = [...new Set(stems(q))];
  if (!ws.length) return 0;
  const t = wordsIn(text);
  const last = typing && /[a-z0-9]$/i.test(q) ? ws.at(-1) : undefined;
  let n = 0;
  for (const w of ws) if (t.has(w) || (w === last && [...t].some((x) => x.startsWith(w)))) n++;
  return n >= Math.ceil(ws.length * 0.6) ? n / ws.length : 0;
}

/**
 * How well a query matches one row, for a box that searches as you type. A name match ranks above any text match,
 * fuzzily so a typo still finds one. Text matches on words (cmdk's fuzzy scorer took ~100ms a keystroke over long
 * descriptions and never matched a sentence), and ranks higher when it names the whole query as typed.
 */
export function rank(q: string, { name, text }: Searchable) {
  const n = defaultFilter(name, q, []);
  if (n >= 0.5) return 1 + n;
  const full = `${name} ${text}`;
  const w = wordShare(q, full, true);
  if (w) return 0.2 + 0.5 * w + (full.toLowerCase().includes(q.trim().toLowerCase()) ? 0.2 : 0);
  return n >= 0.1 ? n : 0;
}

/**
 * The ⌘K palette's groups for a query: matching rows best first, and groups by their best row times the group's
 * `weight` (default 1). Ties keep registry order. With no query, the groups come back as given. cmdk 1.1 cannot
 * reorder groups: it looks each one up by an internal id it never writes to the DOM. So the palette turns cmdk's
 * filter off and ranks with this instead.
 */
export function ranked<R extends Searchable, G extends { rows: R[]; weight?: number }>(groups: G[], q: string): G[] {
  if (!q.trim()) return groups;
  return groups
    .map((g) => {
      const scored = g.rows.map((r) => [rank(q, r), r] as const).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
      return { group: { ...g, rows: scored.map(([, r]) => r) }, best: (scored[0]?.[0] ?? 0) * (g.weight ?? 1) };
    })
    .filter((x) => x.best > 0)
    .sort((a, b) => b.best - a.best)
    .map((x) => x.group);
}
