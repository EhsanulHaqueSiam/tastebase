# Evals

An eval runs a real model against tastebase's real text and checks what the model does. Use one where a unit test
cannot help: what an agent does with a tool description, a skill rule or a `plan` answer changes with every word.

Each layer catches a different way a person asks for one thing and gets another.

What each of tastebase's purposes (see `AGENTS.md`) is measured by:

| Purpose | Measured by |
| --- | --- |
| An agent knows what goes together | `engine.test.ts`: briefs, needs, and per look, product briefs that must read as the look and get its own picks. `registry.test.ts`: every library can win the jobs it claims. `budget.test.ts`: every `get` answer stays within budget. `mcp-tool-use`: an agent asks the right tool and builds with the answer. |
| One prompt, a page worth 9.9/10 | `skill`: the agent opens the skill and follows the flow. `design`: the page works, is what was asked, uses what was offered, reads as its look, and the judge's craft score out of 10. `usage`: the snippets it copies compile. |
| A person can choose by feel | `registry.test.ts`: every library has a screenshot and an icon. `atlas.test.ts`: every library lands in a look group. The site itself is checked by hand with `.agents/skills/test-tastebase`. |

| Layer | Asks | Costs |
| --- | --- | --- |
| `src/engine.test.ts`, `src/registry/registry.test.ts` | Does this brief, typed the way people type, get the right look and libraries? Can every library still win the jobs it claims? | nothing, runs in `pnpm test` |
| `usage` | Does every entry's `usage` snippet compile against the package it names? | no model; about a minute for the whole registry |
| `mcp-tool-use` | Does an agent with only the MCP server call the right tool, with the right arguments, and build with what it is offered? | about 3¢ for all cases |
| `skill` | Does an agent that also has `skills/tastebase/SKILL.md` open it and follow its rules? | about 6¢ |
| `design` | Is the page better with tastebase than without, is it what was asked for, and does it use the libraries tastebase offered? | see the first run in the PR |

## Run

```sh
pnpm eval                      # all of them; only stale cases call a model
pnpm eval skill --case pnpm-lockfile
pnpm eval --check              # no model calls: lists what is stale or regressed, exits 1 if anything is
```

It needs the `claude` CLI, signed in. Each case runs headless Claude Code in a temp directory with the MCP server
from this checkout. Your own CLAUDE.md, plugins, hooks and MCP servers are left out, and a run where the server
or the skill did not reach the agent is an error, not a failure.

Flags: `--case a,b`, `--force` (draw new samples even when nothing changed; for design, also a new page without
tastebase), `--model <id>` and `--judge <id>` (compare another builder or judge; printed and summarised, never
recorded; another judge re-judges the kept pages and builds nothing), `--accept` (record a case that got worse), `--jobs <n>`.

## You only pay for what changed

Every eval has two steps. A **sample** is a paid agent run, kept in `~/.cache/tastebase-evals/<eval>/<model>/` under
its own stamp: a trace for `mcp-tool-use` and `skill`, a built page with its `dist` for `design`. **Grading** reads
kept samples: the checks, and for design the page probe and the judge. The checks and the probe are free; a judge
call on kept screenshots costs about a cent.

Every case has a recorded result in `evals/<eval>/baseline.json` with two fingerprints:

- **What the agent read:** its prompt and project, the harness, the skill, the tool schemas and instructions, and
  tastebase's answers to every call any of its samples made. Replaying those calls against your checkout is free.
- **What grading read:** the checks, the registry fields they use to tell libraries apart, and for design the probe,
  the judge and its questions.

When neither moved, the recorded result stands. When only grading moved, the samples the record rests on are graded
again and nothing is drawn. Only when what the agent read moved are new samples drawn, and only that costs agent
runs. So a change to one library re-runs only the cases whose answers mention it; a change to a tool description
re-runs every case; a change to a check costs nothing. If the kept samples are gone (another machine, a cleared
cache), new ones are drawn instead.

The page without tastebase never reads tastebase's text, so it is built once per machine and kept as the fixed
opponent; only a change to the prompt, the starter or the builder model makes a new one.

`pnpm check` runs `pnpm eval mcp-tool-use skill usage --check`, so CI fails while a result is stale or an
unaccepted regression is recorded. CI never calls a model and has no kept samples, so bring results up to date
locally, where a grader change is free. The design eval only warns in `pnpm check`: run it before a release and
after changes to `src/registry/aesthetics.ts`.

`usage` depends on packages as they are published, which no fingerprint here can see. A weekly workflow
(`.github/workflows/usage.yml`) re-runs it with `--force`; it calls no model.

## What counts as a regression

A case fails checks by name. It got worse when it fails a check the recorded result did not, whether the record
was a pass or a known failure. It got better when it stops failing one.

One odd run must not flip a record in either direction. A sample that matches the record settles it at once, which
is the cheap and common case. One that differs is drawn again, and a third time if those two differ; then each
check counts as failing only when most samples failed it. Two different odd failures are not a regression, and
two different odd passes are not a fix.

A record keeps every sample it rests on and every tastebase call any of them made, so a change to an answer any of
them read makes it stale, and a regrade grades all of them. A regrade that moves the verdict is held to the same
rule as a new sample: one more sample is drawn (that one is paid), and the verdict only moves if most agree. A
grading error that is not a missing sample, such as a judge outage, stops the case without drawing anything.

A regression is recorded as one. Running again, even with `--force`, does not re-roll it: it stays `REGRESSED` for
free until the text changes, or until `--accept` records the loss on purpose. The changed line in `baseline.json` shows it in the PR.
A case recorded as failing without `worse` is a known failure. Those are the to-do list.

## When a case fails

The line names each check that failed and the kept sample under `~/.cache/tastebase-evals/`: for a trace, every
tool call, its result, the final answer and the files written; for design, the build folder with its page,
screenshots and `build.json`. Read it before changing anything. Fix tastebase's text (a
description, the skill, a registry entry), not the case. Loosen a case only when it tested the wrong thing.

Installs are not run in `mcp-tool-use` and `skill`: the command the agent tried is in the trace and that is what
is graded. An agent whose install was refused may tell the user to run it, and that advice is graded too.

## Add a case

Cases are data: `mcp-tool-use/cases.ts`, `skill/cases.ts`, `design/briefs.ts`. A case is a small project, one thing
a user would type, and checks from `shared/checks.ts`.

- A case reproduces a real mistake (`bad`) or protects correct behaviour (`guard`). Name where it came from in `source`.
- Add the case before the fix. It must fail on the old text and pass on the new.
- One rule per case. If the agent can fail it for two reasons, split it or make the prompt remove one.
- Add controls: work tastebase must stay out of. They catch a fix that makes agents call it for everything.
- Import the text under test from source. Never copy a description, a rule or a look into a case.
- "Uses a library" means a source file imports it (comments, strings and READMEs are skipped), or the agent ran the
  command that copies it in, or, where installs are refused, it tried to install it. A feature of a bigger package
  (React's `ViewTransition`) counts by its own import. "Offered" means the pick or an alternative, for the job it
  was offered for. `checks.test.ts` checks every library is recognised from its own `install` and `usage`.
- No user data in cases. Use `acme`.

Engine rows go in `src/engine.test.ts`: a brief or a need and what it must get.

- A row the engine gets wrong today carries `miss: "<why>"`. The test asserts it still fails, so fixing it means
  deleting the `miss`.
- The tests run without stats, but the live server adds up to 1.5 points to a trending library. Each pinned need
  is also run with every rival trending. A pin that only holds on a quiet week carries `sways: "<why>"`.
- The snapshot beside the test records every pick. When a library or a scoring change moves one, the test fails;
  `pnpm test:update` rewrites it, and its diff is the list of picks that moved.

Nothing needs adding for a new library to be covered: `registry.test.ts` checks that every library wins the
first job in its `useFor` and is offered for the rest, and `usage` typechecks its snippet against the package.

## The design eval

Each brief in `design/briefs.ts` is built twice by the same model in the same Vite + React + Tailwind starter:
once with tastebase and once without. The starter's build typechecks, so a prop or export a library does not have
fails the build. Some briefs name their look, some only imply it through the product, and two name none and are
about reaching for the right library.

The build with tastebase passes when all of this holds:

- **It asked.** The build with tastebase called it; one that never did is not a tastebase result.
- **It works.** It builds, renders, throws nothing and does not scroll sideways, at 1440px and at 390px. It uses one
  foundation kit; an effects kit or a shadcn add-on on top of it is fine.
- **It is what was asked for.** The content the brief names is on the page at both widths (`has`; an svg or canvas
  must be chart-sized, not an icon; hidden elements do not count), and pressing the control the brief names opens or
  reveals something visible (`click`).
- **It looks like what was asked for.** A judge sees only the screenshots and names the look, or says none.
- **It follows the look's countable rules** (`limits`), and stops looping for a visitor who asked for less motion.
- **It uses what it was offered.** For each kind of library the brief calls for (`needs`), the page uses one
  tastebase offered. A different library for one of those jobs is a fault too.
- **A craft score.** The look judge also scores the page out of 10. It is reported, not gated, and is the number
  the single-prompt goal of 9.9 is read from.
- **The judge does not prefer the build without tastebase.** The pair is shown unlabelled, twice, in both orders;
  a verdict only counts when both orders agree.

The totals printed after a run are the numbers to watch over time. "Works and is as asked" counts the same checks
for both builds; using what tastebase offered and the judge's preference have rows of their own.

The craft score is capped by the model that builds the page. The record uses Haiku at low effort to stay cheap, so
read the score as a trend, and use `--model` to see what a stronger builder makes of the same text.

**Check the judge before you trust it.** `pnpm eval design --review` writes `review.md` in the cache with every
pair, unlabelled. Write your pick after each `pick:`, run it again, and it reports how often the judge agreed with
you. The summary says "not yet checked against a person" until you have. A pick only counts while the judge's
verdict is on the same pair of builds you saw; after a rebuild it is reported as stale. If agreement is low, fix
the judge's questions in `design/grade.ts` before reading anything into its totals; that re-asks the judge about the
kept pages and builds nothing.

## What is not covered

- Only Claude Code is driven. Codex, Cursor and others read the same text but may act differently.
- The agent evals run the server without stats, so they never see trending numbers in an answer.
- Screenshots show the first screen. The probe does not see gradients, images or canvas loops, and it presses one
  control per brief; it does not walk a flow.
- `usage` checks that a snippet's imports compile against the package. It does not check props or call signatures.
- A trace case that hits its turn cap is graded as finished; its note says so, since a check it failed may be the
  cap's doing.
- The design eval is not sandboxed. Its agent may only run `pnpm add`, `pnpm install`, `pnpm build` and the
  shadcn CLI, and inherits no environment variables beyond the ones the CLI and pnpm need, but it writes code and
  that code is built on your machine. The other evals allow no installs.
- The recorded model is Haiku at low effort, pinned by full id: cheap, and a strict test of how clear the text
  is. A stronger model passes more; check with `--model` before concluding a rule cannot work.
