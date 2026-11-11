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
3. **Pin it**: add a row to the `briefs` or `needs` table in `src/engine.test.ts`. It must fail before your fix.
   If the wrong pick is already there as a `known miss`, delete its `miss`.
4. **Check for collateral**: run `pnpm test`. The snapshot test fails when any pick moved, and a `known miss`
   that now passes fails too. Run `pnpm test:update` and give a reason in the PR for every line in the diff of
   `src/engine.test.ts.snapshot`.
5. Run `pnpm eval`: it re-runs the agent cases whose answers your change touched ([evals/README.md](../../../evals/README.md)).
