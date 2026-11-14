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
- `deploy.yml`: push to `main` → `pnpm check`, deploy `prod`, `pnpm probe`, commit status, then publish the CLI
  to npm as `<major.minor from package.json>.<run number>` (when `NPM_PUBLISH_ENABLED` is `true`). Manual runs redeploy `main` (`force` redeploys
  unchanged resources too).
- `preview.yml`: PR labelled `preview`, same repository only (it runs PR code with credentials).
- `preview-cleanup.yml`: label removed or PR closed → destroy `pr-<n>`. Runs from `main` under
  `pull_request_target`, so no PR code runs next to secrets.

All four stay skipped until the repository variable `DEPLOY_ENABLED` is `true`.

## One-time CI setup

`stacks/github.ts` declares the GitHub side: a Cloudflare API token scoped to Workers, KV, account settings,
tail and Secrets Store write (the state store keeps its auth token there, and binding it needs write); the `CLOUDFLARE_API_TOKEN` and `STATS_GITHUB_TOKEN` secrets; the `CLOUDFLARE_ACCOUNT_ID` and
`DEPLOY_ENABLED` variables; the `preview` and `library` labels. Done for this repo on 2026-11-08; re-run to
rotate the token or change any of it:

```bash
GITHUB_ACCESS_TOKEN="$(gh auth token)" sh scripts/with-env.sh pnpm alchemy deploy --config stacks/github.ts --stage prod
```

Minting the Cloudflare token works with the normal OAuth profile when "Account API Token Provisioning" was
turned on at sign-in (`pnpm alchemy profile edit --reconfigure Cloudflare` to redo it). Otherwise use a profile
holding an API token with Account API Tokens write. Always use `--stage prod` so every machine updates the
same resources.

npm publishes through trusted publishing, so no npm token is stored. The publish job stays skipped until the
repository variable `NPM_PUBLISH_ENABLED` is `true`. Not set up yet: npm only adds a trusted publisher for an
account with 2FA on. Once 2FA is on, run
`npm trust github tastebase --repo EhsanulHaqueSiam/tastebase --file deploy.yml --allow-publish`, then
`gh variable set NPM_PUBLISH_ENABLED --body true`. Until then, publish by hand: bump the minor in
`package.json` (0.1.0 is out, so 0.2.0 next) and merge that, then `pnpm build && npm publish` from `main`. Bump
the minor, not the patch: CI's patch is its run number, which starts low, and a lower version would take `latest`.

## How users get updates

- **Hosted MCP**: every prod deploy.
- **CLI** (`npx -y tastebase@latest`): every prod deploy publishes a new version, once `NPM_PUBLISH_ENABLED` is on.
- **Skill**: the Claude Code plugin (`.claude-plugin/`, no `version`, so each commit is an update) and
  `npx skills add` both read `skills/tastebase` from `main`. Their copies only change when the user updates, so
  the MCP instructions carry `SKILL_VERSION`, a hash of the skill, and send agents whose copy differs to the
  Update section of `/llms.txt`. `src/skill.test.ts` fails until the hash is set after editing the skill.

Not declared because GitHub Free does not offer them on private repos: deployment environments with required
reviewers and branch protection. Add them to the stack when the repo is public or on a paid plan.

## Custom domain

Set `TASTEBASE_DOMAIN` (laptop `.env`, or the repository variable for CI) to a hostname in a zone on the same
Cloudflare account and deploy. `alchemy.run.ts` attaches it to `prod` only.
