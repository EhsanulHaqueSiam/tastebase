# Performance and load

Four tools measure what visitors and agents get. Point them at a `preview` stage (`tastebase-pr-<n>`), never at
prod: they make real requests, and prod's quota is shared with real users.

| Command | What it does | Passes when |
| --- | --- | --- |
| `pnpm bench <url>` | Loads each kind of page cold on desktop and on a phone profile (4x CPU, 150ms RTT, 1.6 Mbps), scores it 0-10 with Lighthouse 12's curves (FCP, LCP, TBT, CLS, TTFB), then clicks every tab and toggle, types in search, opens ⌘K, clicks through to a page and times the live preview, scoring each by INP | every page and profile is 9.5+ on load and interaction, with no sideways scroll, console errors or failed requests |
| `pnpm load <url>` | 40 visitors for 60s over pages, `/api/*` and the hosted MCP, plus 6 CLI processes at once | under 0.5% errors and p95 under 800ms per endpoint; every response compressed, bundles immutable |
| `pnpm cpu` | CPU per Worker route (search, pick, plan, palette list, MCP calls) in Node, the same V8 | p95 under 5ms, half the free plan's 10ms because Workers cores are slower |
| `pnpm bombadil <url> [3m]` | Bombadil explores at desktop and phone size, checking its defaults (HTTP errors, exceptions, rejections, console errors) and `bombadil/specification.ts` | no property is violated in the time limit |

`--runs 3` (the default) takes the median of three cold loads; `--runs 1 --only atlas,home` is for quick checks.
Results land in `bench-results/` (gitignored); `node --experimental-strip-types scripts/requests.ts <url>` lists
what one page downloads, largest first. A Bombadil violation prints a `--reproduce` command and a trace for
`npx bombadil browser inspect`.

Interactions click one second after a control scrolls into view, as a person would; clicking the instant it appears
measures hydration, which the load phase already counts as blocking time.

## Free plan capacity

Prerendered pages, bundles, fonts, screenshots and marks are static assets: free, unlimited, and served without the
Worker. Each page view also runs the Worker once (`POST /api/hit`), and a visitor's first view twice more
(`/api/stats`, `/api/views`, then cached by the browser for 10 minutes). With 100,000 Worker requests a day,
that is roughly 50,000-90,000 page views a day, less whatever the MCP serves. Past the quota the API and MCP fail
until midnight UTC; every page still loads. The other limits sit further out: one Analytics Engine write per view,
one KV read per `/api/stats`, `/api/views` and API call that reads live stats, and no D1 reads unless someone is signed in.

Caching that keeps it there: hashed `/_astro/*` bundles and `/_fonts/*` are `immutable`; screenshots, marks and
sponsor logos get a day fresh and a week stale-while-revalidate (`site/public/_headers`); HTML revalidates on
every load (`max-age=0` with an ETag, so a 304 after a deploy check); `/api/*` answers carry `max-age=300` to
`3600` for the browser. The Worker cannot cache at the edge on `workers.dev`, so a custom domain with Cache Rules
is the next step if the quota ever binds.
