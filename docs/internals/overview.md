# Architecture

```
src/registry (data) ──> src/engine.ts (pick, plan) ──> src/format.ts (compact text)
        │                       │                              │
        │                       └──> site/src/lib/server.ts ──> /api/plan, /api/pick, prerendered pages
        │                                                      └──> /mcp (hosted)   src/cli.ts (stdio)
        └── src/trending.ts <── cron (hourly) ──> KV `stats:v1` ──> merged in at request time

browser ──> /api/auth/* (better-auth: GitHub, Google, X) ──┐
        ──> /api/me, /api/saved, /api/folders,  ──┴──> D1 (migrations/): user, session, saved, folder,
            /api/hidden, /api/off-look, /api/prefs,       hidden, off_look, pref, agent_key
            /api/agent-key, /api/try, /api/connect
        ──> /f/<id> (SSR, a shared folder)
CLI (`tastebase login`) ──> /api/login ──> D1: device_login, agent_key
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
- **An agent key carries a user's taste into `/mcp`, `/api/plan` and `/api/pick`, nothing else.** Signed in, people hide libraries and tools from
  their agent, set a look and framework, and get agent keys (`tb_sk_…`, one per agent or machine, each signed out on its own; D1 keeps its SHA-256, name and last 4). A request with a key
  (Bearer header only: a URL would leave it in logs and history) costs one D1 read: hidden ids leave every answer, hearted libraries get ×1.1 in `pick`
  (a close call, never a clear one), and the saved look and framework stand in only where the call and the brief name
  none (a look the brief names always wins, so a saved look never overrides what the user asked for). No key, no read: answers stay the same for everyone. A wrong key gets a 401,
  not a quiet fallback. The `taste` tool writes through the same key: hide a library or one kit part
  (`library/part`, stripped from the kit's parts so pick and plan never install it), heart one, or mark it off-look.
  Off-look is not a dislike: it leaves the item out under that one look only, and its counts across users
  (`/api/off-look`) are how tune-picks learns which look tags are wrong. Free text can still name a hidden library (a
  note's "use sonner"), so an answer that does ends with a line saying the user hid it.
- **`tastebase login` signs a machine in without a key in any config file.** It makes a random secret, shows the code
  derived from it (8 characters of its SHA-256) and opens `/connect?code=…`; the signed-in user approves the code there,
  and the CLI's poll (`POST /api/login` with the secret, every 2s for 10 minutes) claims a new key named after the machine.
  The server only stores approved codes, so the poll can't be answered for a code nobody approved, and a code alone claims
  nothing. `--token` saves a key made on `/account` instead. The key goes to `~/.config/tastebase/key`: the Claude Code
  plugin's `headersHelper` (`.claude-plugin/key.sh`) sends it, and `npx tastebase` relays stdio to the hosted `/mcp` with it
  (signed out, it answers offline from the registry it ships with).
- **One OAuth app per provider for every stage.** GitHub's redirect URIs are prod, `*.ehsanulsiam.workers.dev`
  (wildcard, so `pr-<n>` previews sign in too), `localhost:1337` and `127.0.0.1` on any port (GitHub's loopback rule).
  Google and X match URIs exactly, so a preview signs in with them only once its URI is registered
  ([deploy.md](../operations/deploy.md#sign-in-providers)). better-auth builds the callback from the request host,
  limited to those hosts (`baseURL.allowedHosts`). Each provider is optional on its own keys and the sign-in sheet
  asks `/api/me` which ones to show; without any (CI's `pnpm check`) `/api/auth/*` answers 404 and the site runs signed out.
- **`/account` is a static shell, and its preview is the agent's own text.** Everything a user controls lives on one
  page (the avatar's sheet links to it). "Try your agent" posts a brief to `/api/try`, which runs `planAnswer` from
  `src/mcp.ts` with the user's taste: the exact text the `plan` tool returns, so the site never drifts from the agent.
- **Each look has a prerendered page (`/looks/<id>`).** Its specimen, a small screen built from its swatch tokens to
  click and type in, every pick per job with its `useFor`, `avoidWhen` and pairings, and the installs `planJson` gives a
  page in that look, all at build time. Specimens are HTML strings from `site/src/lib/specimens.ts` with their CSS in
  `site/src/specimens.css`, shared with `/looks`.
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
- **Prefetch is ours (`site/src/lib/prefetch.ts`), not Astro's.** Pages are served `max-age=0` with no validator, so
  the router's fetch on click could not reuse Astro's `<link rel="prefetch">` copy: every prefetched page was
  downloaded twice, and on a phone a tap's mouseenter started the second download alongside the navigation's. Ours
  keeps the HTML in memory and hands it to the router's loader. Mouse hover and focus warm a link; phones warm the
  tab bar's pages after load.
- **Cards use 720px screenshots** (`/shots/720/`, written by `site/build.ts`, made on request by the dev server):
  under half the bytes of the 1200px originals, which stay where a screenshot is shown large.
- **`build.format: "file"`.** Directory output (`motion/index.html`) makes Cloudflare's asset layer redirect
  `/browse/motion` to `/browse/motion/`, an extra hop on every library link.

## Traps

- `alchemy dev` resolves relative `rootDir`/`main` against the wrong base, and Astro discovers its config from
  the working directory. Hence the absolute paths in `alchemy.run.ts` and `cd site` in `pnpm dev`.
- `pnpm dev` never builds, so `/og/*.jpg` and `/*.md` exist only in deploys (`/shots/720/` is made on request).
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
