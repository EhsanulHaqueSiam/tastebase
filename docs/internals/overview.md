# Architecture

```
src/registry (data) ──> src/engine.ts (pick, plan) ──> src/format.ts (compact text)
        │                       │                              │
        │                       └──> site/src/lib/server.ts ──> /api/plan, /api/pick, prerendered pages
        │                                                      └──> /mcp (hosted)   src/cli.ts (stdio)
        └── src/trending.ts <── cron (hourly) ──> KV `stats:v1` ──> merged in at request time
```

One Cloudflare Worker (declared in `alchemy.run.ts`) does everything:

- **Pages** (`site/src/pages/*.astro`) are prerendered at build time and served as static assets: no Worker
  CPU per visit. Islands receive small props; live numbers (Hot badges, stars) load from `/api/stats`.
- **`/mcp`** is the same `createServer` as the npx CLI, behind the SDK's web-standard Streamable HTTP
  transport. Stateless: a fresh server per request, JSON responses, nothing to store.
- **`/api/*`** returns JSON for islands (hero search, plan box, ⌘K palette). Same engine as MCP.
- **`scheduled()`** (`site/src/worker.ts`) refreshes the 24 stalest libraries' stats each hour.

## Decisions and their reasons

- **Engine is deterministic keyword scoring, no embeddings.** It runs anywhere (Worker, CLI, tests), costs
  nothing, and its reasons are explainable. The calling agent makes the final judgment from the `why` and
  `careful` lines. See [picking.md](picking.md).
- **Stats live in KV, not in git.** They change hourly; committing them would churn the repo and trigger
  deploys. Pages and MCP merge them in at request time; missing stats are fine.
- **Batch of 24 per cron run.** Free-plan Workers allow 50 subrequests per invocation. A batch costs up to
  24 GitHub calls, the batch's scoped npm packages, and one bulk npm call for the unscoped ones.
- **`partOf` entries get no stats.** React's `<ViewTransition>` or GSAP's SplitText point at their parent's
  repo; counting the parent's stars would put them at the top of trending forever.
- **Prerendered pages, live stats from `/api/stats`.** The free plan allows 10ms of CPU per request; an SSR
  render of the home page took ~126ms on a cache miss. Static pages cost nothing, and one cached KV read
  per visitor fills in the live numbers.
- **`build.format: "file"`.** Directory output (`motion/index.html`) makes Cloudflare's asset layer redirect
  `/browse/motion` to `/browse/motion/`, an extra hop on every library link.

## Traps

- `alchemy dev` resolves relative `rootDir`/`main` against the wrong base, and Astro discovers its config from
  the working directory. Hence the absolute paths in `alchemy.run.ts` and `cd site` in `pnpm dev`.
- In dev, Astro's dev server does not load the custom Worker entry, so `scheduled()` never runs locally. The
  dev-only `/api/dev/cron` route calls the same `runStatsRefresh`.
- `Astro.locals.runtime.env` is gone in Astro 6+. Read bindings with `import { env } from "cloudflare:workers"`.
- TextMorph renders a hidden copy of its text for screen readers, so `textContent` of a morphing heading
  shows the word twice. Query the visible spans, not `textContent`.
