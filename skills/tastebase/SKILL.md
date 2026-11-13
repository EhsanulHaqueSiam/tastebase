---
name: tastebase
description: Use before writing any UI (pages, components, animations, icons, backgrounds, charts, sheets, toasts, glass, text effects). Reads the look the user wants, finds proven components for it, installs them and adapts them, instead of building UI from scratch.
---

# tastebase

Skill version 2352d55.

Do not build a UI part from scratch when a proven library already has it. tastebase (MCP server `tastebase`)
knows which library fits which job and which look.

## Every UI task

1. **Reference first.** Before building any screen, have a real reference: one the user gave (a URL, a
   screenshot, an app name) or one you fetched. Fetch in this order: Mobbin MCP if connected (follow the official
   Mobbin skills: `best-practices` first, then `search` before every search call); else Refero MCP (with the Refero
   Skill); else Inspo MCP (free). With none connected, use the look's `references` and the free galleries from
   `get references` (Refero Styles and Devault give a real site's DESIGN.md), and tell the user in one line how to
   connect one: Mobbin (Pro plan): `claude plugin marketplace add mobbin/skills && claude plugin install mobbin@mobbin`;
   Refero (paid MCP; the free Refero Skill: `npx skills add https://github.com/referodesign/refero_skill --skill refero-design`);
   Inspo (free): `npx -y inspo-mcp install`. Name the references you used.
2. **Read the look.** Take it from the user's words ("like Linear", "liquid glass", "neo-brutalism") and from the
   project: its component kit, fonts, colours, DESIGN.md. `get looks` lists every look id by family; `get <look>`
   gives its rules, how it differs from look-alikes (`vs`) and its references. If neither says, `plan` picks one;
   tell the user which.
3. **Find components.** Whole app or page: call `plan` once with the brief, the user's look words included
   ("like Resend", "3D", "scroll animations"); it detects the look. Pass `look` only to override it. Name the project's kit
   in the brief ("we use mantine") so the rest fits it; a kit tastebase does not curate ("we use chakra") is kept
   and the plan only fills gaps. Say what you do not want ("no animation"). One part inside existing UI: call
   `pick` with the job ("copy button that confirms", "bottom sheet", "animated price") and the look; if no library
   fits, it says so and names the kit part to use, if any. Pass `framework` if the project is not React.
4. **Read before installing.** Call `get` for each library you will use, and follow its usage and note.
5. **Install, then adapt.** Install with the project's package manager (`pnpm add` / `bun add` when the
   lockfile says so; run `npx shadcn@latest add ...` as given, after a non-interactive
   `npx shadcn@latest init -b base -p nova` in a fresh app). Add every kit part the screen needs (card, input,
   chart...), not only the example ones in the install line. Then edit the installed component to the look's
   `type`, `colour` and `motion` lines and the project's tokens: props, classes, content. Keep its behaviour,
   accessibility and motion. A kit's defaults are a look of their own (stock shadcn/ui reads as AI-made): set
   radius, fonts and neutrals first, they carry most of the personality.
6. **Build only the gaps.** Write from scratch only what no library covers, and say which parts those are.
7. **Check before you call it done.** Render every screen and look at a screenshot at desktop width and at
   ~390px, next to your references. Run the craft check below on what you see and fix each "no". Where the
   look's rules differ (a gradient look, a maximal look), the look wins.

## Craft check

1. **Focal point.** What is the screen for, and is that the biggest, highest-contrast thing on it? One primary
   button; the others become secondary or text links. The fix is usually removing things.
2. **Spacing.** Every gap sits on a 4 or 8px scale (8, 16, 24, 32). Related items sit closer together than groups
   do, so spacing does the grouping, not boxes and lines.
3. **Type.** Hierarchy comes from weight and colour before size. One or two fonts, slightly tighter tracking on
   headings, short lines, few sizes per card.
4. **Colour.** Tinted neutrals for most of the screen; one accent, only on the primary action, focus and links.
5. **Content.** Real names, numbers, prices and copy for this product. No lorem ipsum or Jane Doe. Ask the user
   for what you lack; never invent testimonials or stats.
6. **Details.** One radius scale, with nested radius = outer radius minus padding. Thin, subtle 1px borders, soft
   layered shadows, icons at one size and stroke, aligned with their text.
7. **Motion.** Motion starts where the user acted: a menu grows from its button, toasts slide in from the edge and
   stack, a sheet follows the finger. Short ease-out, closing faster than opening.
8. **Composition.** Each width is balanced: no dead half-screen or column ending far above its neighbour at desktop.
   On mobile, every tap target is at least 44px (checkboxes and icon buttons included).

## Changing an existing screen

Re-read the look with `get <look>` before changing anything; do not re-plan the app. New parts: `pick` the job
with the project's kit named. A vague ask ("more premium", "more playful") moves within the look's own `type`,
`colour` and `motion` lines (more space, quieter colour, finer details), or to a neighbouring look named in its
`vs` line if the user wants a different direction; say which. Then run the check step again.

For design help that is not installed, `get` a category: `references`, `fonts`, `colour`, `assets`, `tools`
or `directories`. Ask `trending` when the user wants what is new.

## Rules

- The project wins. If it already uses a kit, icon set or motion library, keep it and only fill gaps.
- One component kit per app. Do not mix shadcn/ui with Mantine or HeroUI.
- At most one showpiece per page: one shader hero, animated background or text effect. Many on one page is the
  AI look.
- The look's `type`, `colour`, `motion` and `avoid` lines are design decisions, not hints. So is the `site:` line
  (a 3D, motion-led or media-led page), and it wins over the look on motion.
- Respect `careful:` lines: they mean the library is a poor fit for that use.
- Pause continuous animations (shaders, particles) offscreen and under `prefers-reduced-motion`.

If the `tastebase` tools are missing, set them up from https://tastebase.ehsanulsiam.workers.dev/llms.txt
