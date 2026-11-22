# Performance and load

Four tools measure what visitors and agents get. Point them at a `preview` stage (`tastebase-pr-<n>`), never at
prod: they make real requests, and prod's quota is shared with real users.

| Command | What it does | Passes when |
| --- | --- | --- |
| `pnpm bench <url>` | Loads each kind of page cold on desktop and on a phone profile (4x CPU, Chrome's Slow 4G: 562.5ms RTT per request, 1.47 / 0.675 Mbps), scores it 0-10 with Lighthouse 12's curves and weights (FCP, LCP, TBT, CLS; Speed Index is not measured, so the rest scale up; TTFB is reported only), then clicks every tab and toggle and the header, rail and phone tab bar (touch on the phone), types in search, opens ⌘K and clicks through to a page, scoring each by INP, and the navigation and live preview times on the LCP curve. Each page runs in a fresh browser profile | every page and profile is 9.5+ on load and interaction, with no sideways scroll, console errors or failed requests |
| `pnpm load <url>` | 40 visitors for 60s over pages, `/api/*` (including the view beacon) and the hosted MCP, plus 6 CLI sessions querying for the whole run | under 0.5% errors (an MCP tool error counts, though it answers 200) and p95 under 800ms per endpoint; every response compressed, bundles immutable |
| `pnpm cpu` | CPU per Worker route (search, pick, plan, palette list, MCP calls) in Node, the same V8, and a cold isolate's first MCP requests | warm p95 under 5ms, half the free plan's 10ms because Workers cores are slower; cold under 10ms |
| `pnpm bombadil <url> [3m]` | Bombadil explores at desktop, 2560px wide and phone size, checking its defaults (HTTP errors, exceptions, rejections, console errors) and `bombadil/specification.ts` | no property is violated in the time limit |

`--runs 3` (the default) takes the median of three cold loads; `--runs 1 --only atlas,home` is for quick checks.
Results land in `bench-results/` (gitignored); `node --experimental-strip-types scripts/requests.ts <url>` lists
what one page downloads, largest first. A Bombadil violation prints a `--reproduce` command and a trace for
`npx bombadil browser inspect`. Bombadil also runs against `pnpm dev` (`pnpm bombadil http://localhost:1337`), where
React's development build adds one rare, harmless finding: a hydration warning whose diff shows only
`aria-hidden`/`data-aria-hidden`. That is vaul hiding the page behind an open sheet before an island under it
hydrated; the sheet removes them on close, and production React neither warns nor patches.

Interactions click one second after a control scrolls into view, as a person would; clicking the instant it appears
measures hydration, which the load phase already counts as blocking time.

Two judgement calls, stated so they can be argued with. INP counts each event to the end of the main thread's work
for it (its handlers, through the end of any long animation frame), not to the next presented frame: headless Chrome
can hold a frame back for seconds where a visitor's browser does not (a header click measured 3.7s headless and 24ms
in the real browser). And the live preview, another site loading in a frame, is held to the phone LCP curve (2.5s
scores 0.9) on desktop too; navigation between our own pages keeps each profile's own curve.

## Free plan capacity

Prerendered pages, bundles, fonts, screenshots and marks are static assets: free, unlimited, and served without the
Worker. A visit that only browses runs the Worker about three times: one `POST /api/hit` carrying all its page views,
sent when the tab is hidden or closed (`site/src/lib/views.ts`), and `/api/stats` and `/api/views` once (then the
browser keeps them for 10 minutes). Each search on the home page (one request per pause in typing), plan demo
brief, first palette open (`/api/libs`), shared folder (`/f/<id>`, rendered per request) and screenshot match adds
one. With 100,000 Worker requests a day shared with the MCP, that is about 30,000 browsing visits a day, fewer when
people search. Past the quota the API and MCP fail until midnight UTC; every prerendered page still loads.

The other limits sit further out. KV: each isolate keeps the stats and view totals for a minute
(`site/src/lib/server.ts`), so reads scale with isolates, not requests. Analytics Engine: one write per visit, plus
one per library each MCP `plan` or `pick` offers (5 to 12 a call), so heavy agent traffic reaches its daily write
allowance before the Worker quota; check the account's Analytics Engine usage if MCP calls grow. D1: signed-in
requests, plus two reads for every visit to a shared folder `/f/<id>`, signed in or not. Workers AI: each screenshot
match (`/api/match`, same-origin only) spends part of the free daily neuron allowance; once it is spent, matching
answers "today's free limit" until 00:00 UTC.

Caching that keeps it there: hashed `/_astro/*` bundles and `/_fonts/*` are `immutable`; screenshots, marks and
sponsor logos get a day fresh and a week stale-while-revalidate (`site/public/_headers`); HTML is `max-age=0` with
no ETag, so a repeat visit downloads the page again (static, so no Worker cost; 20-185 KB compressed);
`/api/*` answers carry `max-age=300` to `3600` for the browser. The Worker cannot cache at the edge on `workers.dev`, so a custom domain with Cache Rules
is the next step if the quota ever binds.
