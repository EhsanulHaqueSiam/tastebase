# Deploying

## Stages

| Stage | How | URL |
| --- | --- | --- |
| `prod` | push to `main` (CI), or `pnpm run deploy` | https://tastebase.ehsanulsiam.workers.dev |
| `pr-<n>` | label a same-repo PR `preview` | `tastebase-pr-<n>.<account>.workers.dev`, posted on the PR |
| `dev_<user>` | `pnpm dev` | localhost |

State for every stage lives in Alchemy's Cloudflare state store, so CI and laptops see the same deployments.

## From a laptop

```bash
pnpm plan          # what would change in prod
pnpm run deploy    # apply (pnpm's own `deploy` command shadows the script name)
pnpm logs          # tail Workers Logs
pnpm probe https://tastebase.ehsanulsiam.workers.dev
```

## CI

- `ci.yml`: `pnpm check` on every PR and push.
- `deploy.yml`: push to `main` → `pnpm check`, deploy `prod`, `pnpm probe`, commit status. Manual runs
  redeploy `main` (`force` redeploys unchanged resources too).
- `preview.yml`: PR labelled `preview`, same repository only (it runs PR code with credentials).
- `preview-cleanup.yml`: label removed or PR closed → destroy `pr-<n>`. Runs from `main` under
  `pull_request_target`, so no PR code runs next to secrets.

All four stay skipped until the repository variable `DEPLOY_ENABLED` is `true`.

## One-time CI setup

`stacks/github.ts` declares the GitHub side: a Cloudflare API token scoped to Workers, KV, account settings
and tail; the `CLOUDFLARE_API_TOKEN` and `STATS_GITHUB_TOKEN` secrets; the `CLOUDFLARE_ACCOUNT_ID` and
`DEPLOY_ENABLED` variables; the `preview` and `library` labels. Done for this repo on 2026-11-08; re-run to
rotate the token or change any of it:

```bash
GITHUB_ACCESS_TOKEN="$(gh auth token)" sh scripts/with-env.sh pnpm alchemy deploy --config stacks/github.ts --stage prod
```

Minting the Cloudflare token works with the normal OAuth profile when "Account API Token Provisioning" was
turned on at sign-in (`pnpm alchemy profile edit --reconfigure Cloudflare` to redo it). Otherwise use a profile
holding an API token with Account API Tokens write. Always use `--stage prod` so every machine updates the
same resources.

Not declared because GitHub Free does not offer them on private repos: deployment environments with required
reviewers and branch protection. Add them to the stack when the repo is public or on a paid plan.

## Custom domain

Set `TASTEBASE_DOMAIN` (laptop `.env`, or the repository variable for CI) to a hostname in a zone on the same
Cloudflare account and deploy. `alchemy.run.ts` attaches it to `prod` only.
