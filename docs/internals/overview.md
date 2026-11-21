# Architecture

```
src/registry (data) ──> src/engine.ts (pick, plan) ──> src/format.ts (compact text)
        │                       │                              │
        │                       └──> site/src/lib/server.ts ──> /api/plan, /api/pick, prerendered pages
        │                                                      └──> /mcp (hosted)   src/cli.ts (stdio)
        └── src/trending.ts <── cron (hourly) ──> KV `stats:v1` ──> merged in at request time

browser ──> /api/auth/* (better-auth: GitHub, Google, X) ──┐
        ──> /api/me, /api/saved, /api/folders ──┴──> D1 (migrations/): user, session, saved, folder
        ──> /f/<id> (SSR, a shared folder)
```

One Cloudflare Worker (declared in `alchemy.run.ts`) does everything:

- **Pages** (`site/src/pages/*.astro`) are prerendered at build time and served as static assets: no Worker
  CPU per visit. Islands receive small props; live numbers (Hot badges, stars) load from `/api/stats`.
- **`/mcp`** is the same `createServer` as the npx CLI, behind the SDK's web-standard Streamable HTTP
  transport. Stateless: a fresh server per request, JSON responses, nothing to store.
- **`/api/*`** returns JSON for islands (hero search, plan box, ⌘K palette). Same engine as MCP.
- **Accounts** (`site/src/lib/auth.ts`, `auth-data.ts`): better-auth on D1, sign-in with GitHub, Google or X, a session cookie.
  The browser store (`site/src/lib/saved.ts`) holds hearts and folders for every island.
- **`scheduled()`** (`site/src/worker.ts`) refreshes the 24 stalest libraries' stats each hour, and the site's
  30-day page views (`/api/views`).
- **Share cards and Markdown copies** (`site/build.ts`) are written after prerendering: `/og/<path>.jpg` for every
  page's `og:image`, `/<path>.md` for AI crawlers. Each page links its copy as `rel=alternate`.

## Decisions and their reasons

- **Engine is deterministic keyword scoring, no embeddings.** It runs anywhere (Worker, CLI, tests), costs
  nothing, and its reasons are explainable. The calling agent makes the final judgment from the `why` and
  `careful` lines. See [picking.md](picking.md).
- **Stats live in KV, not in git.** They change hourly; committing them would churn the repo and trigger
  deploys. Pages and MCP merge them in at request time; missing stats are fine.
- **Agent uses go to Analytics Engine, not KV.** The hosted MCP server writes one data point per library it hands
  an agent (`get`, and each pick a `plan` or `pick` offers): the id only, never the caller or the query. Writes are
  free and are not subrequests; KV's 1,000 writes a day would not survive one busy hour. The cron reads the 7-day
  totals back with one SQL API call (an Account Analytics Read token minted in `stacks/github.ts`) into the stats blob.
- **Batch of 24 per cron run.** Free-plan Workers allow 50 subrequests per invocation. A batch costs up to
  24 GitHub calls, the batch's scoped npm packages, and one bulk npm call for the unscoped ones.
- **`partOf` entries get no stats.** React's `<ViewTransition>` or GSAP's SplitText point at their parent's
  repo; counting the parent's stars would put them at the top of trending forever.
- **Prerendered pages, live stats from `/api/stats`.** The free plan allows 10ms of CPU per request; an SSR
  render of the home page took ~126ms on a cache miss. Static pages cost nothing, and one cached KV read
  per visitor fills in the live numbers.
- **Signed-out visits never reach the Worker for account data.** Pages stay static; the browser asks `/api/me`
  only when it started a sign-in itself (a localStorage flag), so the free plan's 100k requests a day are spent on
  people who have accounts. Signed out, hearts stay in localStorage; the first sign-in on a device moves them into
  the account and clears them locally.
- **Hearts and folders hold registry ids only.** The API drops any id the registry does not know, which also bounds
  what one account can store; folders are capped at 100 per user. Every write is scoped `where userId = ?`, and a
  folder that is not yours answers 404, never 403, so private ids do not leak.
- **One OAuth app per provider for every stage.** GitHub's redirect URIs are prod, `*.ehsanulsiam.workers.dev`
  (wildcard, so `pr-<n>` previews sign in too), `localhost:1337` and `127.0.0.1` on any port (GitHub's loopback rule).
  Google and X match URIs exactly, so a preview signs in with them only once its URI is registered
  ([deploy.md](../operations/deploy.md#sign-in-providers)). better-auth builds the callback from the request host,
  limited to those hosts (`baseURL.allowedHosts`). Each provider is optional on its own keys and the sign-in sheet
  asks `/api/me` which ones to show; without any (CI's `pnpm check`) `/api/auth/*` answers 404 and the site runs signed out.
- **`/f/<id>` renders per request, its cards in the browser** (`client:only`). The server does one D1 read for a
  public folder (for a private one, a session read and a second folder read) and no React render, inside the 10ms CPU budget.
- **Pages stay static assets; the Markdown copies are static too.** Each page links its `.md` copy as
  `rel=alternate`. Content negotiation on `Accept` or the user agent would need every page view to run the Worker
  first (`runWorkerFirst`), which costs a Worker request per view and the static-asset response time, so we do not.
- **Page views go to Analytics Engine from a beacon, not from the Worker.** Client navigations and prefetches never
  reach the Worker as a document request, so the page posts `/api/hit` on each `astro:page-load`. No cookie: the
  browser flags itself as a visitor once per 30 days in localStorage, so "visitors" counts browsers.
- **Share cards are drawn at build time** with satori and sharp in Node (Inter, the screenshot beside the title). Doing
  it per request would blow the 10ms CPU budget, and Workers cannot run sharp.
- **`build.format: "file"`.** Directory output (`motion/index.html`) makes Cloudflare's asset layer redirect
  `/browse/motion` to `/browse/motion/`, an extra hop on every library link.

## Traps

- `alchemy dev` resolves relative `rootDir`/`main` against the wrong base, and Astro discovers its config from
  the working directory. Hence the absolute paths in `alchemy.run.ts` and `cd site` in `pnpm dev`.
- `pnpm dev` never builds, so `/og/*.jpg` and `/*.md` exist only in deploys.
- In dev, Astro's dev server does not load the custom Worker entry, so `scheduled()` never runs locally. The
  dev-only `/api/dev/cron` route calls the same `runStatsRefresh`.
- `Astro.locals.runtime.env` is gone in Astro 6+. Read bindings with `import { env } from "cloudflare:workers"`.
- `pnpm dev` on a port other than 1337: sign in at `http://127.0.0.1:<port>`, not `localhost:<port>`; GitHub only
  accepts other ports on the loopback IP.
- D1 migrations in `migrations/` are applied by Alchemy on deploy (and to the local D1 on `pnpm dev`); add a new
  numbered file, never edit an applied one. `0001_accounts.sql` holds better-auth's tables as its `getMigrations`
  compiles them; regenerate that part when upgrading better-auth adds columns.
- TextMorph renders a hidden copy of its text for screen readers, so `textContent` of a morphing heading
  shows the word twice. Query the visible spans, not `textContent`.
