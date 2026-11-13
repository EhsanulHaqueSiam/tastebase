# The Atlas

`/atlas` groups libraries by look so similar-looking ones sit together, shows what is free, and lines up what each
library ships. All of it is computed at build time by `src/atlas.ts`; the page ships static HTML plus a small script
for tabs and toggles.

## Decisions

- **Groups come from the curated `aesthetic` tags, not from screenshots.** A library's first look is its group. A
  look with more than six libraries splits by second look (`minimal / technical`), because one huge "minimal" group
  says nothing. Wrong grouping means a wrong tag: fix the entry, not the layout.
- **"Near" means "tagged together".** Look affinity is how often two looks share a library across the whole
  registry, so it follows the data as entries change. Island positions start from classical MDS on that affinity,
  get pulled toward the centre, then pushed apart until no box overlaps (`src/atlas.test.ts` checks every view).
  Side walls keep every box inside the target width; a sideways push that would cross one goes vertical, so a
  crowded map grows taller instead of overflowing its container.
- **Box sizes are fixed numbers** (`ISLAND` in `src/atlas.ts`), mirrored in the page's CSS. The layout runs without a
  browser, so it cannot measure text; every row and header has a fixed height and long names truncate.
- **Best free** is the look's own curated pick (from `aesthetics.ts`) when it is free, else the first free library
  in registry order. Free only dims a library when it is mostly paid: more `parts` behind the paywall than free
  (`paywalled()`, e.g. Kobra, Hugeicons). A few paid extras on a large free core (Aceternity, HeroUI) or a paid tier
  that only sells templates (Magic UI Pro) keep it in; its price still shows in the bars. `paid` is only the maker
  selling more of the same thing or a required editor, never optional hosting or other file formats.
- **The parts matrix only compares names shared by two or more libraries**, merged through a small alias list
  (`Modal` = `Dialog`, `Fill` = `Solid`, `Area Chart` = `Area`). Columns are not just the most common names: each
  library first gets its three most widely shared parts in, so an effects kit (Marquee, Globe) is not an empty row
  beside base kits (Button, Dialog), and the rest fill by frequency. A library that shares nothing is left out of
  the table. Categories with fewer than four comparable libraries show per-library lists on `/browse/<id>` instead.
- **Icons must show on true black.** A mark that is a dark glyph on transparency is invisible; recolour it white
  after `pnpm capture`.

## Traps

- Non-default panels render with `hidden`, so their lazy images never load. Removing that makes every tab's
  screenshots download on first paint.
- Adding a field to `ISLAND` without the matching CSS variable in `atlas.astro` breaks the no-overlap guarantee
  visually even though the test still passes.

## Resources tab

Resources are not libraries, so they get no look groups. The tab lists them in `resourceKinds` order with a
category filter (linkable as `#resources/<category>`); the same categories group them in the ⌘K palette and answer `get <category>` over MCP, so a new
category only needs a label in `resourceKinds`.
