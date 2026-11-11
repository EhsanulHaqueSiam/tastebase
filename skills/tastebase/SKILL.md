---
name: tastebase
description: Use before writing any UI (pages, components, animations, icons, backgrounds, charts, sheets, toasts, glass, text effects). Reads the look the user wants, finds proven components for it, installs them and adapts them, instead of building UI from scratch.
---

# tastebase

Do not build a UI part from scratch when a proven library already has it. tastebase (MCP server `tastebase`)
knows which library fits which job and which look.

## Every UI task

1. **Read the look.** Take it from the user's words ("like Linear", "liquid glass", "playful") and from the
   project: its component kit, fonts, colours, DESIGN.md. If neither says, `plan` picks one; tell the user which.
2. **Find components.** Whole app or page: call `plan` once with the brief and the look. One part inside
   existing UI: call `pick` with the job ("copy button that confirms", "bottom sheet", "animated price") and
   the look. Pass `framework` if the project is not React.
3. **Read before installing.** Call `get` for each library you will use, and follow its usage and note.
4. **Install, then adapt.** Install with the project's package manager (`pnpm add` / `bun add` when the
   lockfile says so; run `npx shadcn@latest add ...` as given). Then edit the installed component to the look's
   `type`, `colour` and `motion` lines and the project's tokens: props, classes, content. Keep its behaviour,
   accessibility and motion.
5. **Build only the gaps.** Write from scratch only what no library covers, and say which parts those are.

For design help that is not installed, `get` a category: `references`, `fonts`, `colour`, `assets`, `tools`
or `directories`. Ask `trending` when the user wants what is new.

## Rules

- The project wins. If it already uses a kit, icon set or motion library, keep it and only fill gaps.
- One component kit per app. Do not mix shadcn/ui with Mantine or HeroUI.
- The look's `type`, `colour`, `motion` and `avoid` lines are design decisions, not hints.
- Respect `careful:` lines: they mean the library is a poor fit for that use.
- Pause continuous animations (shaders, particles) offscreen and under `prefers-reduced-motion`.

If the `tastebase` tools are missing, set them up from https://tastebase.ehsanulsiam.workers.dev/llms.txt
