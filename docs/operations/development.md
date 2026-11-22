# Development

## First checkout

```bash
pnpm i
cp .env.example .env          # then fill in STATS_GITHUB_TOKEN (and ALCHEMY_PROFILE if not "default")
pnpm alchemy profile edit --add Cloudflare   # once: OAuth into your Cloudflare account
pnpm dev
```

T3 Code worktrees run `scripts/setup-worktree.ts` automatically (`t3.json`): it links the main checkout's
`.env` and installs with a frozen lockfile.

## Local stack

`pnpm dev` is `alchemy dev` from `site/`: Astro's dev server with SSR in workerd, the real bindings, and a
local KV. Stage `dev_<user>`; the Cloudflare account is only used for Alchemy's state store. Then:

- `pnpm probe http://localhost:1337` checks pages, API and every MCP tool (use the printed port).
- `pnpm flows http://localhost:1337 [flow ...]` walks the UI flows with a real mouse, keys and wheel at phone,
  desktop and 2560px sizes, and fails on a broken step or any console error: the /browse sheet (open, close by ×,
  Esc, backdrop and Back, Forward, "Try these", a job pressed while open, and its place beside the nav rail), filters
  and scroll surviving Back, detail panels that must not scroll the page, the taste survey, the card buttons signed
  out, ⌘K and the tab bar. Flow names are the keys in `scripts/flows.ts`. Run it after any change to those.
- `pnpm bombadil http://localhost:1337 [3m]` explores the site on its own ([performance.md](performance.md)); it
  works against `pnpm dev` too.
- `curl "localhost:1337/api/dev/cron?batch=80"` fills local stats (real GitHub/npm calls with your token).
- Point an agent at your local MCP: `claude mcp add --transport http tastebase-dev http://localhost:1337/mcp`.

Stop `pnpm dev` with Ctrl+C in its terminal, or kill the PID you started. Remove the dev stage's state with
`pnpm destroy:dev`.

## Profiles

Alchemy credentials live in `~/.alchemy/profiles/<name>/`. Commands use `$ALCHEMY_PROFILE`, else `default`.
Our scripts load `.env` first (`scripts/with-env.sh`), so `ALCHEMY_PROFILE=siamdev` in `.env` pins a project to
one account without touching your other projects.

## Checks

`pnpm check` = root typecheck (TypeScript 7) + site typecheck (`astro sync` + TypeScript 6, because
`astro check` does not support TS 7) + tests + MCP bundle. CI runs exactly this.

## Reference sources

`pnpm sync:repos` clones pinned, read-only sources into `.repos/` (gitignored). Alchemy v2 is beta and newer
than most models' training data: read `.repos/alchemy/AGENTS.md` and its `.agents/skills` before changing
`alchemy.run.ts`.
