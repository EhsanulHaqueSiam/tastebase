---
name: tastebase
description: Pick proven UI libraries before writing interface code. Use whenever building or restyling UI (pages, components, animations, icons, backgrounds, charts, drawers, toasts, glass, text effects) so the work uses a curated library chosen for the job and the look instead of hand-rolled defaults.
---

# tastebase

tastebase is an MCP server (`tastebase`) that knows which UI library fits which job and which look.

## Workflow

1. **Whole app or page:** call `plan` once with the brief in the user's words, including any look they named
   ("like Linear", "liquid glass", "playful"). Pass `framework` if the project is not React.
2. **One job inside existing UI:** call `pick` with the job ("copy button that confirms", "bottom sheet",
   "animated price"). Pass the project's look if you know it.
3. Call `get` only for the libraries you will install. Follow its usage and note.
   For design help that is not installed, `get` a category: `references`, `fonts`, `colour`, `assets`, `tools`
   (agent design skills, DESIGN.md generators) or `directories` (more components to install).
4. Install with the project's package manager (swap `npm i` for `pnpm add` / `bun add` when the lockfile says so).
   Copy-in registries (`npx shadcn@latest add ...`) are fine to run as given.

## Rules

- The project wins. If it already uses a kit, icon set or motion library, keep it and only fill gaps.
- One component kit per app. Do not mix shadcn/ui with Mantine or HeroUI.
- Follow the look's `type`, `colour`, `motion` and `avoid` lines from `plan`; they are design decisions, not hints.
- Respect `careful:` lines: they mean the library is a poor fit for that use.
- Pause continuous animations (shaders, particles) offscreen and under `prefers-reduced-motion`.

## Setup (once)

```bash
claude mcp add --transport http tastebase https://tastebase.ehsanulsiam.workers.dev/mcp   # hosted
# or, offline: claude mcp add tastebase -- npx -y tastebase
```

Ask `trending` when the user wants what is new or popular right now.
