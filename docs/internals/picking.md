# How picking works

`pick(need)` scores every library for one job; `plan(brief)` chooses a base kit, then runs `pick` once per need.

## Matching

- Jobs match on whole stemmed words (`terms`, `words` in `engine.ts`), so "software" is not "soft", "client" is not
  "cli" and "dev-tool" equals "dev tool". Plurals fold onto the singular ("files" = "file", "glasses" = "glass").
  "Bottom sheet" and "progress bar" are one word each: a progress bar is a kit part, not progress in general. The
  `NEEDS` regexes start at a word boundary for the same reason ("typography" is not "graph"), and skip phrases that
  look like a kind but are not one: "progress" alone is no toast, "infinite scroll" is a list, "solid colour
  background" is CSS. Framework names and look words ("react", "style", "look") are stop words: the framework filter
  handles the first, and "in the Aurora look" is not a job.
- Look signals match unstemmed (`plain`: plurals folded, nothing else), so "weather app" is not "weathered".
- Negations are cut out of the brief before anything matches; the kinds they name are left out and reported as
  `left out`. "no X and Y" rules out X only; "without X and Y" both. A library whose best use case or tagline names
  a ruled-out word loses 3 ("no animation and charts": recharts, not the animated charts).

## Score

- `useFor`: the closest use case counts ×3 per matching term; every other matching term across the remaining use
  cases adds 1. The best line is returned as `why`.
- name/tagline overlap ×2, `note` overlap ×0.5.
- **Kind match**: +4 when the library's primary kind is the job; +1.5 when it only `alsoCovers` it.
- **Look bonus**: +8/+6/+4 for the look's own picks (rank 0/1/2 among those that run on the framework), else up to +2
  for listing the look's family in `aesthetic`.
- Maturity: established +1, stable +0.6. Momentum: up to +1.5 for weekly star gain; it breaks ties, never
  overrides fit.

Terms are expanded with a small synonym table (`SYN`: notification→toast, sheet→drawer, ...). Add synonyms there
before adding scoring rules. Scores count terms; the fit and avoid decisions below count job words (`matched`): a word
counts once however many synonyms match, and never through two hops ("hero" → background ← "gradient").

## A real fit or nothing

A library is offered only when it is named, is the look's pick, or the job's words appear in one of its use cases or
its tagline and it does the job's kind (two shared words when the job names no kind). Junk alternatives come from
skipping this, so it holds inside plan slots too. On top of it:

- **Its own `avoidWhen` wins**: only the situation before the colon counts. Sharing 2+ words with the job and more
  than its best use case: the library is out, and so is anything that fits the job less. When the library does the
  job's own kind, anything that fits only as well goes too ("gantt chart": recharts says no, and no chart library
  names gantt, so nothing), except what the line sends the job to ("revenue chart": lightweight-charts says recharts).
  As close as its best use case: −3 and `careful`.
- **Whole kits are bases, not answers.** A kit installed whole (Mantine, MUI, Vuetify) never answers one job and never
  fills a slot under another base: a date picker is the project kit's part, or React Aria, not MUI.
- **The thing asked for.** In a single `pick`, when a library of the job's kind names what asked for the kind
  ("typewriter", "confetti"), the rest of that kind are dropped: a typewriter headline is not a hand-drawn underline.
  The look's own words ("aurora") do not count as the ask. Plan slots keep their alternatives and lead with the one
  that names it instead.
- **Inside a slot**, words that asked for another slot are no reason ("a data table and toasts" does not make a
  skeleton loader fit the toasts). The slot's own kind word ranks but is fit only when the brief asked for the kind.
- **Kits that are a look** (`themed`: everything in `data/themed.ts`, plus entries flagged in other files) appear
  only when the look picks them or the brief names them; outside a plan, when the job describes them and names their
  theme, the tagline before its colon ("windows 95 dialog" is 98.css; "progress bar" is not NES.css).
- **Stay in the look**: when something tagged for the look's family or picked by it fits and names what was asked,
  libraries from other families are dropped ("animated number counter": number-flow and torph, not rough-notation).
  One that only shares the slot's kind word does not hold others out (a playful bottom sheet is vaul, not bencho).
- Nothing fits: `kitParts` names the kits whose `parts` cover the job ("progress bar" → Progress), by its last word
  when the job names no kind ("accessible combobox" → Combobox; a gantt chart is not a kit's Chart, and "rich text
  editor" never matches a part called Text).

## Looks

`detectLooks` scores each look's matched phrases by word count. Naming a look outright is +2: a family's id or name
bare, a style's when it is two words or more ("neo-brutalism"), and any look's name or signal followed by a qualifier
("in the Fluent look", "windows 98 style", "look: memphis"). A phrase inside a longer one that another look matched
belongs to that look ("material design 3" is Material You, not Material Design). Everyday and component words
(`WEAK`: smooth, clean, sheet, table...) count 0.5 and never pick a look alone: "a smooth checkout flow" and
"bottom sheet for filters" stay on the default `minimal`, flagged as defaulted. A style adds its family's score when
it matched itself, and wins ties.

## Plan

1. **Base kit first.** A kit or primitives library the brief names ("we use mantine", "on shadcn") wins. A popular kit
   the registry does not curate (`ELSEWHERE`: Chakra, Ant Design, Bootstrap...) is kept: the plan says so, has no
   base pick, and adds no shadcn registry items. Else a style's own `component-kit` or `primitives` pick (one that
   differs from its family's, since the registry index merges family picks into styles), minus any whose own
   `avoidWhen` fits the brief better than its use cases ("Mac OS 9 Platinum" is not 1-bit system.css), with any whose
   avoid line fits as well put behind the rest ("federal benefits form": govuk-frontend says uswds). Of several, the
   one the brief names by id ("Windows XP" → xp-css), else one whose use cases it clearly describes, else the first.
   Else the best ranked foundation kit, `primitives` for raw families (brutalist, editorial, luxury, retro). Effects
   kits (component kits that also cover motion, background or text-effects, like Aceternity) never rank as the base,
   nor do mostly paid kits (`paywalled`: Kobra). A base kit whose avoid line sends the job to an effects kit stays the
   base with that line as `careful` (shadcn/ui for a motion-first landing page, with Magic UI on top).
2. **Needs**: kinds the brief names, icons, and the look's `needs` (data: apple adds motion and sheets, glass adds
   glass and a backdrop, aurora and mesh gradient a backdrop, document an editor; a style's list replaces its
   family's). A page gets no shader for being a landing page: that is the AI look. Kinds the look's `avoid` list names
   bare ("gradients and glass") are never added unasked. A 3D scene is the page's one showpiece, so a backdrop the
   look adds is dropped when the brief asks for 3D. A kind the look added is filled only by its picks, in its order,
   and dropped when none run on the framework (glass on React Native).
   **Site type** (`sites.ts`: 3D, motion-led, media-led) is detected from its signals as whole words, at most one.
   It adds its `needs` whatever the look's motion rule and removes its `drops` from what the look added (a shader
   behind a 3D scene or a video); a kind the brief itself asks for stays. In its kinds its picks lead whatever the
   look, and score as the look's own so they are among the candidates: the look is how the page looks, the site
   type what it is built from.
3. **Empty pick lists are decisions**: `picks.background: []` means the look uses no library for it (web1, retro-os,
   flat design...), so plans neither add nor fill it; glassmorphism's `glass: []` prints "plain CSS". A brief that asks
   for the kind in words other than the look's own ("like Linear with a shader hero") still gets one.
4. **One stack.** Each slot ranks with the base kit in mind: +2 for pairing with it (`pairsWith` either way), −6
   for another kit's ecosystem (a `shadcn@` registry install under Mantine). Libraries built for the slot lead unless
   they are off-kit; among them, one whose tagline names what the brief asked for ("confetti") leads the look's
   general pick. When the base kit `alsoCovers` the slot, ships the thing asked for (its tagline, use cases or parts
   name it) and no specialist pairs with it, the base kit takes it (Mantine's notifications for toasts, not Sonner;
   canvas-confetti for confetti). When nothing curated of the kind runs on the framework, the base kit's part is named
   (panelui's BottomSheet on React Native); when something does but none fits the job, nothing is. Unforced, the top
   three ranked kits each get a full plan and the highest total wins, so a chat app gets shadcn/ui with AI Elements,
   not Astryx's built-in chat.
5. **Framework** is read from the brief with its negations cut out ("React, not Angular" is React), else React,
   flagged as assumed. "Solid" names SolidJS only as `solidjs`, `solid-js` or `solid start`. Installs come from
   `installWith[base kit]` (BlockNote on shadcn/ui), then `installFor[framework]` (vue-sonner), then `install`;
   `install` in `format.ts` is the one resolver the MCP answer and the site's plan both use.

Plan lines give the use case a library was picked for in place of its tagline (`get` has the rest), and a price only
for mostly paid libraries.

Registry text is parsed once per Worker (`parsed` cache): the first plan in an isolate costs about 7ms, later ones
under 1ms.

`src/engine.test.ts` pins the picks that matter: golden briefs across looks and frameworks, single jobs for `pick`,
site types, the rows the engine still gets wrong (`miss`), and a snapshot of every pick. When a change moves one, say
which and why in the PR.

## Known limits

Momentum is meant to break ties, but two libraries within 1.5 points are a tie in practice: a few pinned picks
flip when a rival trends. Those rows carry `sways` in the test.
