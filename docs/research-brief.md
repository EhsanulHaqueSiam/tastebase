# Registry research brief (for helper agents)

tastebase is a curated registry of UI libraries plus an MCP server that lets coding agents (Claude Code) pick the
right library for a UI job. The registry entries ARE the product: an agent reads `useFor`, `avoidWhen`,
`aesthetic`, `alternatives` and `note` to decide what to install. Accuracy and judgment matter more than count.

Repo: `/home/siam/Projects/tastebase`. Contract: `src/registry/schema.ts` (read it fully first; type `Library`).

## Your output
One file you own, `src/registry/data/<yours>.ts`, shaped exactly like:

```ts
import type { Library } from "../schema.ts";

export default [
  {
    id: "torph",
    name: "Torph",
    tagline: "Animated text morphing: labels change letter by letter instead of swapping.",
    kind: "text-effects",
    frameworks: ["react", "vue", "svelte", "vanilla"],
    styling: "unstyled",
    aesthetic: ["minimal", "apple", "technical"],
    useFor: [
      "copy button that confirms in place (Copy -> Copied)",
      "status labels that progress (Processing -> Sent)",
      "tabs or toggles whose label text changes",
    ],
    avoidWhen: [
      "long paragraphs or body copy: morphing many glyphs reads as noise",
      "numbers that count or roll: use number-flow instead",
    ],
    pairsWith: ["motion", "number-flow"],
    alternatives: ["motion"],
    install: "npm i torph",
    usage: "import { TextMorph } from 'torph/react'\n\n<TextMorph>{copied ? 'Copied' : 'Copy'}</TextMorph>",
    note: "Wrap only the text that changes, never the whole button, so layout stays stable. Default duration 400ms with cubic-bezier(0.19, 1, 0.22, 1) is right for UI; go lower, not higher. Dependency-free, so it is fine in small bundles.",
    weight: "tiny",
    a11y: "ok",
    maturity: "experimental",
    url: "https://torph.lochie.me",
    repo: "https://github.com/lochie/torph",
    npm: "torph",
    author: "Lochie Axon",
    license: "MIT",
  },
] satisfies Library[];
```

## Rules
- Verify every library is real and current: `npm view <pkg> version license repository.url homepage` and, for
  GitHub repos, `gh api repos/<owner>/<repo> --jq '.stargazers_count,.pushed_at,.archived,.license.spdx_id'`.
  Skip archived or abandoned (no push in ~18 months) libraries unless they are still the standard.
- `usage` must be the real API (read the README: `npm view <pkg> readme | head -120`). No invented props.
- `useFor` are concrete situations, not features. `avoidWhen` always says what to use instead when possible.
- `alternatives` / `pairsWith` may reference ids in other files; use these canonical ids where relevant:
  shadcn-ui, base-ui, radix-ui, react-aria, motion, gsap, torph, number-flow, sonner, vaul, cmdk, glisse,
  lucide, paper-shaders, three, r3f, recharts, lenis, embla-carousel, magic-ui, aceternity-ui, react-bits,
  motion-primitives, animate-ui, kobra. If you add others, choose the npm name without scope as id.
- Copy-in registries (shadcn-style) use `styling: "copy-in"` and the real `npx shadcn@latest add ...` install.
- Do not edit any file except yours. Do not run `pnpm add`. Do not commit.
- Check your file: `cd /home/siam/Projects/tastebase && npx tsc --noEmit -p .` must pass for your file.
- Finish with a short report: entries added, anything you skipped and why, any id you referenced that is not
  in the canonical list above.
