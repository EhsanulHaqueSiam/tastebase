# tastebase

Hand-picked UI libraries, each with notes on **when to use it, when not to, and which look it fits**, served to
coding agents over MCP so they install the right library instead of hand-rolling generic UI.

**https://tastebase.ehsanulsiam.workers.dev**

## Use it from your agent

```bash
claude mcp add --transport http tastebase https://tastebase.ehsanulsiam.workers.dev/mcp   # hosted, nothing to install
codex mcp add tastebase --url https://tastebase.ehsanulsiam.workers.dev/mcp              # same server in Codex
mkdir -p .claude/skills/tastebase && curl -fsSL https://tastebase.ehsanulsiam.workers.dev/skill.md -o .claude/skills/tastebase/SKILL.md   # asks before writing UI
```

Other agents (Cursor, VS Code) and the Codex skill path: [llms.txt](https://tastebase.ehsanulsiam.workers.dev/llms.txt).

| Tool | Input | Returns | Typical cost |
| --- | --- | --- | --- |
| `plan` | a whole brief: "iOS-feel habit tracker with charts" | the look's type/colour/motion rules, one library per need with install command and reason | ~570 tokens |
| `pick` | one job: "copy button that confirms" | top 3 with reasons and "careful" notes | ~160 tokens |
| `get` | an id (`vaul`) or a look (`apple`) | usage, agent note, adoption, use/avoid lists, alternatives | ~400 tokens |
| `trending` | optional kind or framework | libraries gaining the most GitHub stars this week | ~250 tokens |

77 libraries across 14 kinds of job and 12 looks. Every library belongs to its authors; tastebase writes the notes.

## Work on it

```bash
pnpm i && cp .env.example .env
pnpm dev          # the whole stack locally through Alchemy (site, /api, /mcp, KV)
pnpm check        # what CI runs
```

- [AGENTS.md](AGENTS.md): what we protect, where code lives, how to verify (for agents and people)
- [docs/operations/development.md](docs/operations/development.md): local stack, profiles, reference sources
- [docs/operations/deploy.md](docs/operations/deploy.md): stages, CI, previews, one-time setup
- [docs/internals/overview.md](docs/internals/overview.md): architecture and the decisions behind it
- [CONTRIBUTING.md](CONTRIBUTING.md): adding libraries, reporting wrong picks, pull requests

Stack: Astro 7 + React islands (Motion, Torph, NumberFlow, Paper Shaders, Glisse) on one Cloudflare Worker, with
KV and an hourly cron, all declared in [`alchemy.run.ts`](alchemy.run.ts) (Alchemy v2).
