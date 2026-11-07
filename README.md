# tastebase

Hand-picked UI libraries, each with notes on **when to use it, when not to, and which look it fits**, served to coding
agents over MCP so they install the right library instead of hand-rolling generic UI.

## For agents

```bash
claude mcp add --transport http tastebase https://<site>/mcp   # hosted MCP, nothing to install
claude mcp add tastebase -- npx -y tastebase                    # or run it locally
npx skills add EhsanulHaqueSiam/tastebase                       # skill that tells Claude to ask before writing UI
```

Four tools, short text answers:

| Tool | Input | Returns | Typical cost |
| --- | --- | --- | --- |
| `plan` | a whole brief: "iOS-feel habit tracker with charts" | detected look and its type/colour/motion rules, one library per need with install command and reason | ~570 tokens |
| `pick` | one job: "copy button that confirms" | top 3 with reason and "careful" notes | ~160 tokens |
| `get` | an id: `vaul`, or a look: `apple` | usage, agent note, use/avoid lists, pairs and alternatives | ~360 tokens |
| `trending` | optional kind or framework | libraries gaining the most GitHub stars this week | ~250 tokens |

## Layout

```
src/registry/schema.ts       the contract: Library and Aesthetic types
src/registry/data/*.ts       77 curated entries (kits, motion, visuals)
src/registry/aesthetics.ts   12 looks: signals, picks per kind, type/colour/motion rules
src/engine.ts                pick() and plan(): deterministic scoring, no network
src/format.ts                compact text answers
src/mcp.ts, src/cli.ts       MCP server; `npx tastebase` starts it on stdio, site/src/pages/mcp.ts hosts it over HTTP
src/trending.ts              GitHub stars and npm downloads, refreshed by the Worker's hourly cron into KV
skills/tastebase/SKILL.md    the agent skill
site/                        Astro 7 + React islands (Motion, Torph, NumberFlow, Paper Shaders), server-rendered on the Worker
alchemy.run.ts               infrastructure: one Worker (site, /mcp, /api, cron) + a KV namespace, state on Cloudflare
stacks/github.ts             one-off: mints the scoped CI token and stores GitHub Actions secrets
scripts/capture.ts           screenshots and favicons for the site
```

## Develop

```bash
pnpm i
pnpm test            # registry integrity, engine picks, trending math
pnpm build           # bundles the stdio MCP server to dist/
pnpm dev             # alchemy dev: Astro dev server with SSR in workerd and real bindings
```

## Deploy (Cloudflare, Alchemy)

One-time setup on a laptop:

```bash
pnpm alchemy profile edit --profile siamdev --add Cloudflare   # OAuth as ehsanul.siamdev@gmail.com; enable "Account API Token Provisioning"
echo "STATS_GITHUB_TOKEN=<fine-grained token, public repos read-only>" > .env
pnpm run deploy                               # alchemy deploy --stage prod (pnpm's own `deploy` shadows the script)
```

CI (`.github/workflows/deploy.yml`): pushes to `main` deploy `prod`, each PR gets a `pr-N` preview that is destroyed
when the PR closes. Its secrets are created once from code, with an admin profile that can mint tokens:

```bash
pnpm alchemy profile create admin && pnpm alchemy profile edit --profile admin --add Cloudflare   # API token/key, not OAuth
pnpm alchemy deploy --config stacks/github.ts --profile admin
```

Everything fits Cloudflare's free plan: static assets are free, the Worker stays well under 100k requests/day, and
the cron refreshes 24 libraries per hourly run to stay under the 50-subrequest limit.

Adding a library: add an entry to a data file, run `pnpm test` (it checks ids and cross-references), then
`node --experimental-strip-types scripts/capture.ts <id>` for its screenshot.

Every library belongs to its authors; tastebase only writes the notes.
