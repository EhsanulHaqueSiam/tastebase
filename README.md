# tastebase

Hand-picked UI libraries, each with notes on **when to use it, when not to, and which look it fits**, served to coding
agents over MCP so they install the right library instead of hand-rolling generic UI.

## For agents

```bash
claude mcp add tastebase -- npx -y tastebase     # MCP server
npx skills add EhsanulHaqueSiam/tastebase        # skill that tells Claude to ask before writing UI
```

Three tools, short text answers:

| Tool | Input | Returns | Typical cost |
| --- | --- | --- | --- |
| `plan` | a whole brief: "iOS-feel habit tracker with charts" | detected look and its type/colour/motion rules, one library per need with install command and reason | ~570 tokens |
| `pick` | one job: "copy button that confirms" | top 3 with reason and "careful" notes | ~160 tokens |
| `get` | an id: `vaul`, or a look: `apple` | usage, agent note, use/avoid lists, pairs and alternatives | ~360 tokens |

## Layout

```
src/registry/schema.ts       the contract: Library and Aesthetic types
src/registry/data/*.ts       77 curated entries (kits, motion, visuals)
src/registry/aesthetics.ts   12 looks: signals, picks per kind, type/colour/motion rules
src/engine.ts                pick() and plan(): deterministic scoring, no network
src/format.ts                compact text answers
src/mcp.ts, src/cli.ts       MCP server; `npx tastebase` starts it on stdio
skills/tastebase/SKILL.md    the agent skill
site/                        the website (Vite, React, Tailwind, Motion), reads the same registry
scripts/capture.ts           screenshots and favicons for the site
scripts/trending.ts          GitHub stars and npm downloads, run daily by .github/workflows/trending.yml
```

## Develop

```bash
pnpm i
pnpm test            # registry integrity + engine picks
pnpm build           # bundles the MCP server to dist/
pnpm dev:site        # website on localhost
```

Adding a library: add an entry to a data file, run `pnpm test` (it checks ids and cross-references), then
`node --experimental-strip-types scripts/capture.ts <id>` for its screenshot.

Every library belongs to its authors; tastebase only writes the notes.
