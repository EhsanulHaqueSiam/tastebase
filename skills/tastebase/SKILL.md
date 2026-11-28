---
name: tastebase
description: Use before writing any UI (pages, components, animations, icons, backgrounds, charts, sheets, toasts, glass, text effects). Reads the look the user wants, finds proven components for it, installs them and adapts them, instead of building UI from scratch. Also when the user rejects a UI library or component ("never recommend X", "X clashes with this look"): saves it to their tastebase account.
---

# tastebase

Skill version 158b25b.

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
   Inspo (free): `npx -y inspo-mcp install`. For motion in a site, app or video (an animated hero, kinetic
   type, product UI, a chart that builds), also take a piece from Prompt Motion (https://prompt-motion.com): each
   comes with the prompt or skill that made it; start from that prompt, build it in the project's motion library
   and hold it to the look. When a reference is a live site and you have `capture` (`npx tastebase` runs it in the
   user's Chrome), capture its URL: you get its real colours, fonts, sizes, radius, shadows, spacing and CSS
   variables plus a screenshot; match those, with your own content. Name the references you used and keep their images (videos for motion) for step 8.
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
4. **Use every pick.** Each plan line is a part the brief or the look needs, with its usage under it: install that
   library and build the part with it, rather than writing your own. Call `get` for a library's note and parts.
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
   look's rules differ (a gradient look, a maximal look), the look wins, except on item 1.
8. **Review until 9.5.** Reviewers: the `council` skill if you have it (three reviewers on different models), else
   one fresh subagent that did not build it; with neither, review it yourself, strictly. Each scores out of 10 and
   names the fixes that would raise the score. Fix what holds up, capture again and review again, until every score
   is 9.5 or more. Fixes serve the brief: do not add scope to raise a score.
   - **Screens:** one PNG with every screen at desktop and ~390px, given with the reference images from step 1 and
     the craft check.
   - **Motion:** record each interaction and give frames from it (6 to 8 per transition, with their times) or a
     breakdown (what moves, from where, how long, which easing, how it exits), with the references' videos and the
     `emil-design-eng` skill if you have it, else the craft check's motion item.

## Craft check

1. **The brief, unbroken.** Every part the brief names is there and works, and the first screen shows the main
   one, not an empty hero. No look excuses text under 4.5:1 contrast, a headline clipped or split mid-word at
   390px, or a font you named that never loaded.
2. **Focal point.** What is the screen for, and is that the biggest, highest-contrast thing on it? One primary
   button; the others become secondary or text links. The fix is usually removing things.
3. **Spacing.** Every gap sits on a 4 or 8px scale (8, 16, 24, 32). Related items sit closer together than groups
   do, so spacing does the grouping, not boxes and lines.
4. **Type.** Hierarchy comes from weight and colour before size. One or two fonts, slightly tighter tracking on
   headings, short lines, few sizes per card.
5. **Colour.** Tinted neutrals for most of the screen; one accent, only on the primary action, focus and links.
6. **Content.** Real names, numbers, prices and copy for this product. No lorem ipsum or Jane Doe. Ask the user
   for what you lack; never invent testimonials or stats.
7. **Details.** One radius scale, with nested radius = outer radius minus padding. Thin, subtle 1px borders, soft
   layered shadows, icons from one library at one size and stroke (set once with its provider, as the plan's usage
   shows), aligned with their text.
8. **Motion.** Motion starts where the user acted: a menu grows from its button, toasts slide in from the edge and
   stack, a sheet follows the finger. Short ease-out, closing faster than opening.
9. **Composition.** Each width is balanced: no dead half-screen or column ending far above its neighbour at desktop.
   On mobile, every tap target is at least 44px (checkboxes and icon buttons included).

## Changing an existing screen

Re-read the look with `get <look>` before changing anything; do not re-plan the app. New parts: `pick` the job
with the project's kit named. A vague ask ("more premium", "more playful") moves within the look's own `type`,
`colour` and `motion` lines (more space, quieter colour, finer details), or to a neighbouring look named in its
`vs` line if the user wants a different direction; say which. Then run the check step again.

For design help that is not installed, `get` a category: `references`, `fonts`, `colour`, `assets`, `agent-tools`
or `directories`. Ask `trending` when the user wants what is new.

When the user rejects a library or one part of a kit ("never recommend Sonner", "that toast clashes with this
look"), save it with `taste`, not a memory note: `hide`, or `off-look` with the look id when it only clashes with
this look. It follows them to every project.

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
