# Contributing

Setup, the local stack and checks: [docs/operations/development.md](docs/operations/development.md).
How the code is organized and what we protect: [AGENTS.md](AGENTS.md) (written for agents, useful for people).

## What helps most

- **Registry entries**: a library we are missing, or a better `useFor` / `avoidWhen` for one we have.
  Follow [.agents/skills/add-library](.agents/skills/add-library/SKILL.md). Suggest one without code through
  the "Suggest a library" issue form.
- **Wrong picks**: a brief or job where `plan` / `pick` recommends the wrong library. Open an issue with the
  exact input and what you expected; fixes follow [.agents/skills/tune-picks](.agents/skills/tune-picks/SKILL.md).
- **Bugs** in the site, API or MCP server, with steps to reproduce.

## Pull requests

- One problem per PR. Conventional commit title in plain language: `fix(engine): toasts no longer pick Mantine`.
- Body: the problem, the change, how you verified it (`pnpm check` plus what you exercised). UI changes need
  before/after screenshots; motion needs a short recording. Upload them to the PR, do not commit them.
- `pnpm eval` needs the `claude` CLI. If `pnpm check` says recorded eval results are stale and you cannot run it,
  say so in the PR and a maintainer will.
- Maintainers can label a PR `preview` to deploy it to its own stage. Merging to `main` deploys production.
- If an agent did the work, say which model and harness at the end of the description.

## Ground rules

- Every library belongs to its authors. Entries link to the real project and credit its author.
- Facts come from npm, GitHub and the project's docs, not memory.
- Keep answers small: `src/budget.test.ts` fails when tool schemas or answers grow past budget.
