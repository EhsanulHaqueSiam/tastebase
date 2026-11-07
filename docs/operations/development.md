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
