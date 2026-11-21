# Performance and load

Four tools measure what visitors and agents get. Point them at a `preview` stage (`tastebase-pr-<n>`), never at
prod: they make real requests, and prod's quota is shared with real users.

| Command | What it does | Passes when |
| --- | --- | --- |
| `pnpm bench <url>` | Loads each kind of page cold on desktop and on a phone profile (4x CPU, 150ms RTT, 1.6 Mbps), scores it 0-10 with Lighthouse 12's curves and weights (FCP, LCP, TBT, CLS; Speed Index is not measured, so the rest scale up; TTFB is reported only), then clicks every tab and toggle and the header, rail and phone tab bar (touch on the phone), types in search, opens ⌘K and clicks through to a page, scoring each by INP, and the navigation and live preview times on the LCP curve. Each page runs in a fresh browser profile | every page and profile is 9.5+ on load and interaction, with no sideways scroll, console errors or failed requests |
| `pnpm load <url>` | 40 visitors for 60s over pages, `/api/*` (including the view beacon) and the hosted MCP, plus 6 CLI sessions querying for the whole run | under 0.5% errors (an MCP tool error counts, though it answers 200) and p95 under 800ms per endpoint; every response compressed, bundles immutable |
| `pnpm cpu` | CPU per Worker route (search, pick, plan, palette list, MCP calls) in Node, the same V8, and a cold isolate's first MCP requests | warm p95 under 5ms, half the free plan's 10ms because Workers cores are slower; cold under 10ms |
| `pnpm bombadil <url> [3m]` | Bombadil explores at desktop and phone size, checking its defaults (HTTP errors, exceptions, rejections, console errors) and `bombadil/specification.ts` | no property is violated in the time limit |

`--runs 3` (the default) takes the median of three cold loads; `--runs 1 --only atlas,home` is for quick checks.
Results land in `bench-results/` (gitignored); `node --experimental-strip-types scripts/requests.ts <url>` lists
what one page downloads, largest first. A Bombadil violation prints a `--reproduce` command and a trace for
`npx bombadil browser inspect`.

Interactions click one second after a control scrolls into view, as a person would; clicking the instant it appears
measures hydration, which the load phase already counts as blocking time.

## Free plan capacity

Prerendered pages, bundles, fonts, screenshots and marks are static assets: free, unlimited, and served without the
Worker. A visit runs the Worker about three times: one `POST /api/hit` carrying all its page views, sent when the tab
is hidden or closed (`site/src/lib/views.ts`), and `/api/stats` and `/api/views` once (then the browser keeps them
for 10 minutes). With 100,000 Worker requests a day shared with the API and MCP, that is about 30,000 visits a day
before agents' calls, whatever the pages per visit. Past the quota the API and MCP fail until midnight UTC; every
page still loads.

The other limits sit further out. KV: each isolate keeps the stats and view totals for a minute
(`site/src/lib/server.ts`), so reads scale with isolates, not requests. Analytics Engine: one write per visit, plus
one per library each MCP `plan` or `pick` offers (5 to 12 a call). D1: reads only when someone is signed in.

Caching that keeps it there: hashed `/_astro/*` bundles and `/_fonts/*` are `immutable`; screenshots, marks and
sponsor logos get a day fresh and a week stale-while-revalidate (`site/public/_headers`); HTML is `max-age=0` with
no ETag, so a repeat visit downloads the page again (static, so no Worker cost; 20-185 KB compressed);
`/api/*` answers carry `max-age=300` to `3600` for the browser. The Worker cannot cache at the edge on `workers.dev`, so a custom domain with Cache Rules
is the next step if the quota ever binds.
