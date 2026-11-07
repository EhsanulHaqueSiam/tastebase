---
name: tune-picks
description: Change how tastebase ranks libraries (engine scoring, synonyms, look picks, need detection) without silently breaking other recommendations. Use when a pick or plan returns the wrong library.
---

# Tune picks

Read [docs/internals/picking.md](../../../docs/internals/picking.md) first.

1. **Reproduce** with the smallest call: `pick(libraries, "<need>")` or `plan(libraries, aesthetics, "<brief>")`
   in a `node --experimental-strip-types` snippet, printing ids and scores.
2. **Fix the cheapest layer first**, in this order: the entry's `useFor`/`avoidWhen` text, a synonym in `SYN`,
   the look's `picks`, a `NEEDS` regex, and only then a scoring weight in `engine.ts`.
3. **Pin it**: add the case to `src/engine.test.ts` (extend an existing test where one fits). It must fail
   before your fix.
4. **Check for collateral**: run `pnpm test` and compare the plans for the briefs in `engine.test.ts` before
   and after. List every pick that moved in the PR, with a reason.
5. Run `pnpm test` again for the token budget if you changed answer formatting.
