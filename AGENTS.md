# tastebase

tastebase is a curated registry of UI libraries plus an MCP server that tells coding agents which library to
use for a job and a look. The registry entries are the product: an agent reads `useFor`, `avoidWhen`,
`aesthetic`, `alternatives` and `note` to decide what to install. The website shows the same data and the same
engine, so what a person sees is what the agent gets.

Live: https://tastebase.ehsanulsiam.workers.dev (hosted MCP at `/mcp`).

## What we never compromise on

1. **Picks are right.** A wrong recommendation costs a user a bad install. Accuracy and judgment beat count.
   Every entry is verified against npm and GitHub, every `usage` is the real API.
2. **Agents spend few tokens.** Tool schemas and answers have a budget (`src/budget.test.ts`). Answers are
   compact text, not JSON. If you raise a budget, say why in the PR.
3. **The site feels premium and stays light.** Motion is feedback, not decoration on a loop. No continuously
   repainting animation except shaders, which pause offscreen and under `prefers-reduced-motion`.
4. **It runs on Cloudflare's free plan.** One Worker, one KV namespace, an hourly cron. The limits that bite:
   10ms CPU per request (keep pages prerendered; check `pnpm logs` for `cpu:`), 50 subrequests per invocation,
   1,000 KV writes a day.

Keep things simple: the smallest model that makes the correct behavior unsurprising. Fight scope creep.

## Glossary

- **library**: one registry entry (`Library` in `src/registry/schema.ts`), keyed by `id`.
- **kind**: the job a library does (`component-kit`, `motion`, `text-effects`, ...). One primary, optional `alsoCovers`.
- **look**: an aesthetic guide (`Aesthetic`, `src/registry/aesthetics.ts`): signals, picks per kind, type/colour/motion rules.
- **pick**: best libraries for one job. **plan**: one pick per need for a whole brief.
- **stats**: stars, weekly star gain, npm downloads. Written to KV by the cron; never committed.
- **stage**: an isolated Alchemy deployment: `prod`, `pr-<n>` previews, `dev_<user>` local.

## The ways to hurt yourself

1. **Deploying prod by accident.** `pnpm run deploy` targets stage `prod`. CI deploys prod on every push to
   `main`. Use `pnpm dev` for local work and the `preview` PR label for a shared preview. Never run
   `alchemy destroy --stage prod`.
2. **Killing by pattern.** Never `pkill -f` or kill a PID found by name: your own agent's command line matches
   too. Kill only the PID you captured when you started the process.
3. **Leaking secrets.** `.env` holds `STATS_GITHUB_TOKEN` and `ALCHEMY_PROFILE`. It is gitignored; worktrees
   get a symlink to the main checkout's copy. Never print, commit or paste its values.
4. **Trusting memory for new APIs.** Alchemy v2 (beta), Astro 7, Torph, Glisse and others are newer than most
   training data. Read the installed types or `.repos/` (`pnpm sync:repos`) before writing against them.

## Where code lives

- `src/registry/` - the data. `schema.ts` is the contract; `data/{kits,motion,visuals}.ts` the entries;
  `aesthetics.ts` the looks. Adding a library: the [add-library skill](.agents/skills/add-library/SKILL.md).
- `src/engine.ts` - `pick()` and `plan()`, deterministic scoring. Why it scores the way it does:
  [docs/internals/picking.md](docs/internals/picking.md).
- `src/format.ts` - the compact text agents read. `src/mcp.ts` - tool definitions. `src/cli.ts` - `npx tastebase` (stdio).
- `src/trending.ts` - stats refresh (GitHub + npm), shared by the cron and tests.
- `site/` - Astro 7 with React islands. `src/pages` are prerendered (static); `src/pages/api` and `mcp.ts` run
  on the Worker; `src/components` are islands; `src/lib/server.ts` is server-only (registry, engine, KV).
  Islands get props, call `/api/*`, or read live stats with `useStats()` (`src/lib/stats.ts`).
- `alchemy.run.ts` - all app infrastructure. `stacks/github.ts` - CI token, GitHub secrets, variables, labels.
- `skills/tastebase/` - the skill we ship to users. `.agents/skills/` - skills for working on this repo
  (`.claude/skills` links to it).
- `.repos/` - read-only reference sources, gitignored. Never edit or import from them.

Architecture in one page: [docs/internals/overview.md](docs/internals/overview.md).

## Running it

- `pnpm i`, or let `t3.json`'s Setup Worktree script do it. While `.t3/setup-running` names a live PID, wait;
  it ends with `.t3/setup-done` or `.t3/setup-failed`.
- `pnpm dev` runs the whole stack locally through Alchemy: Astro's dev server with SSR in workerd, a local KV,
  your `.env` secrets. It prints the URL (port 1337, or the next free one). Stage `dev_<user>`.
- Fill local trending data: `curl "localhost:<port>/api/dev/cron?batch=80"` (dev only; runs the real cron body).
- `pnpm probe <url>` smoke-tests any running copy: pages, API, all MCP tools with token counts.
- Details, profiles and troubleshooting: [docs/operations/development.md](docs/operations/development.md).

## Verifying

- `pnpm check` before you push: root typecheck, site typecheck, tests, MCP build. CI runs the same command.
- Test behavior that can break: engine ranking, trending math, registry integrity, the token budget. Add a row
  to an existing test before writing a new one. Do not test what types guarantee, copy text or static markup.
- Ranking changes: run the briefs in `src/engine.test.ts` and say in the PR which picks moved and why.
- UI changes: open the page in the browser (`.agents/skills/test-tastebase`), check desktop and ~390px, and
  attach before/after screenshots. Motion changes get a short recording.

## Shipping

- Conventional commit titles in plain language: `feat(registry): add tanstack table`.
- PR body: the problem in a sentence or two, then the change, then how you verified it.
- Label a same-repo PR `preview` to get stage `pr-<n>` and its URL in a comment; closing the PR destroys it.
- Merging to `main` deploys prod (`.github/workflows/deploy.yml`) and smoke-tests it with `pnpm probe`.
- Deploys, previews and the one-time CI setup: [docs/operations/deploy.md](docs/operations/deploy.md).

## Documentation

`docs/internals/` holds decisions and traps a reader would get wrong without it, not feature catalogs.
`docs/operations/` holds procedures. A local reason belongs in a one-line code comment. When a decision
changes, rewrite the text; do not append history. Do not commit plans or scratch notes.

## Taste

- Inferred types over annotations; `any` is the enemy.
- Default to no comment; write one only for a constraint or quirk the code can't show.
- The look rules in `aesthetics.ts` are design decisions. The site follows its own `minimal` and `technical`
  looks: true black, white text, one accent, small precise type, motion under 300ms.
