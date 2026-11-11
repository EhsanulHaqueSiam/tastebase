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
- `paid`: what the paid tier adds, its price and pricing URL, read from the pricing page. Leave it out when nothing
  costs money. It drives the Atlas Free-only filter and the `paid tier` note agents see.
- `parts`: what it ships, as the docs name it (components for kits and primitives, styles for icons, chart types
  for charts, named effects for collections). `parts.paid` lists only parts that exist solely behind the paywall.

## 4. Assets and checks

```bash
pnpm capture <id>     # screenshot to site/public/shots, favicon to site/public/marks
pnpm test             # ids unique, references resolve, shared repos marked partOf, picks still right
pnpm eval             # typechecks the new `usage` against the real package, re-runs agent cases it changed
```

`pnpm test` also checks the new entry can win the first job in its `useFor` and is offered for the rest. If it
says a pick moved, the entry took a job from another library. Decide whether it should; then `pnpm test:update`
records it.

Look at the screenshot: blank, cookie-wall or loading screens need a retry (see `scripts/capture.ts`) or the
repo page instead. Then `pnpm dev` and check `/browse/<id>`, and `pnpm probe` for the MCP answers.

## Adding a design resource instead

Sites that help design but are not installed (galleries, fonts, colour tools, assets, agent design skills, component
directories) go in `src/registry/resources.ts` under the matching `kind` from `resourceKinds`, next to the others of
that kind. Read the pricing page for `cost` and set `free` to whether it is usable for real without paying. Add `mcp`
only for a server the user connects under their own account. A new category needs a label in `resourceKinds`; the
Atlas filter, the ⌘K palette and `get <category>` pick it up from there.

## 5. PR

Title `feat(registry): add <name>`, label `library`. Say which jobs it now wins in `pick` and confirm the
engine tests still pass without edits (or explain each changed expectation).
