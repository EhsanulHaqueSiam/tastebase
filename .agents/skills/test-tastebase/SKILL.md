---
name: test-tastebase
description: Run tastebase locally through Alchemy and verify the site, API and MCP server, in a browser and with the probe script. Use to check any change before calling it done, and to reproduce bugs.
---

# Test tastebase

## Start it

Reuse a healthy `pnpm dev` from this task if one is running. Otherwise start `pnpm dev` in the background,
keep its PID, and read the URL from its `ready at http://localhost:<port>` line (1337, or the next free port).
Do not deploy to test: `pnpm run deploy` is production.

## Check the server side

```bash
pnpm probe http://localhost:<port>                # pages, /api, every MCP tool with token counts
curl "localhost:<port>/api/dev/cron?batch=80"      # fill local trending stats when the change needs them
```

`pnpm test` covers ranking, trending math, registry integrity and the token budget; run it for any change
under `src/`.

## Check the UI

Open `http://localhost:<port>` in the browser panel (T3 Code: `preview_open` / `preview_navigate`; otherwise
the agent-browser or playwright skills). Exercise the change, not just the page load:

- hero search, the plan box (switch briefs), ⌘K palette, a `/browse/<id>` page with a live demo
- ~390px, 1440px and a wide screen, 1920 to 2560px (no horizontal scroll: `document.documentElement.scrollWidth === innerWidth`)
- `pnpm flows http://localhost:<port>` for the flows (the /browse sheet, Back, the survey, card buttons, ⌘K,
  keyboard focus, and signed in: hearts, folders, hiding, the agent key)
- reduced motion when you touched animation

Capture before/after screenshots for UI changes and a short recording for motion.

## Clean up

Stop only the `pnpm dev` you started, by its PID (or Ctrl+C in its terminal). Never kill by name.
