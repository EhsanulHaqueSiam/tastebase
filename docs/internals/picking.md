# How picking works

`pick(need)` scores every library for one job; `plan(brief)` runs `pick` once per detected need.

## Score

- `useFor` overlap ×3 per matching term (the strongest signal: written as situations), plus the best line as `why`.
- name/tagline overlap ×2, `note` overlap ×0.5.
- **Kind match**: +4 when the library's primary kind is the job; +1.5 when it only `alsoCovers` it. A kit
  that happens to ship toasts must not beat Sonner for "toast".
- **Look bonus**: +8/+6/+4 for the look's own picks (rank 0/1/2), else up to +2 for listing the look in
  `aesthetic`. The look's curated picks should usually win over keyword luck.
- `avoidWhen` overlap of 2+ terms: −3 and the line is returned as `careful`.
- Maturity: established +1, stable +0.6. Momentum: up to +1.5 for weekly star gain; it breaks ties, never
  overrides fit.

Terms are lowercased, stop-worded, crudely stemmed, and expanded with a small synonym table (`SYN` in
`engine.ts`: notification→toast, sheet→drawer, ...). Add synonyms there before adding scoring rules.

## Plan

1. Detect looks from `signals` (phrase matches weigh more). None found: `minimal`, flagged as assumed.
2. Detect the framework from the brief (`nuxt`, `svelte`, `expo`...); none found: React, flagged as assumed.
3. Needs: a base layer (`component-kit`, or `primitives` for raw looks like brutalist/editorial/luxury/retro),
   every kind whose regex matches the brief, and the look's `motion`/`background`/`glass` picks.
4. Per need: primary-kind libraries lead, kits that merely cover it become alternatives. **Effects kits**
   (component kits that also cover motion/background/text-effects, like Aceternity) never fill the base slot.

`src/engine.test.ts` pins the picks that matter. When a change moves one, say which and why in the PR.
