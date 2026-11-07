---
name: add-library
description: Add or update a library in the tastebase registry, verified against npm and GitHub, with a screenshot, favicon and passing integrity tests. Use when asked to add, update, fix or remove a registry entry.
---

# Add a library

The entry is what agents read to decide whether to install it, so judgment matters more than volume.

## 1. Decide it belongs

- It is maintained (pushed in the last ~18 months, not archived) or still the standard despite age.
- It is the best choice for at least one concrete job. If an existing entry already covers that job better,
  improve that entry instead.
- Check the license; note restrictions (Commons Clause, no-resale) in `note`.

## 2. Verify facts, never recall them

```bash
npm view <pkg> version license repository.url homepage
npm view <pkg> readme | head -150            # real API for `usage`
gh api repos/<owner>/<repo> --jq '.stargazers_count,.pushed_at,.archived,.license.spdx_id'
```

For copy-in registries (shadcn-style) dry-run the real install: `npx shadcn@latest add <item> --dry-run`.

## 3. Write the entry

Pick the data file by kind: `src/registry/data/kits.ts` (component kits, primitives, command, agent UI),
`motion.ts` (motion, text effects, interaction, feedback, scroll, glass), `visuals.ts` (icons, backgrounds,
3D, charts). Follow `src/registry/schema.ts` exactly. The fields that decide picks:

- `useFor`: concrete situations ("copy button that confirms in place"), not features. Scored highest.
- `avoidWhen`: when it is the wrong choice, and what to use instead.
- `aesthetic`: looks it fits, best first. Also add its id to the right `picks` in `src/registry/aesthetics.ts`
  if it should be a look's default.
- `alternatives` / `pairsWith`: ids that exist in the registry.
- `note`: 2-5 sentences an agent needs to use it well: defaults that matter, mistakes to avoid.
- `partOf`: set it when the entry is a feature of a larger package (shares its repo or npm package).

## 4. Assets and checks

```bash
pnpm capture <id>     # screenshot to site/public/shots, favicon to site/public/marks
pnpm test             # ids unique, references resolve, shared repos marked partOf, picks still right
```

Look at the screenshot: blank, cookie-wall or loading screens need a retry (see `scripts/capture.ts`) or the
repo page instead. Then `pnpm dev` and check `/browse/<id>`, and `pnpm probe` for the MCP answers.

## 5. PR

Title `feat(registry): add <name>`, label `library`. Say which jobs it now wins in `pick` and confirm the
engine tests still pass without edits (or explain each changed expectation).
