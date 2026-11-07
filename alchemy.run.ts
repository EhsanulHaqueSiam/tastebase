// Infrastructure for tastebase, deployed with `pnpm deploy` (alchemy deploy).
// One Worker serves the Astro site, the hosted MCP endpoint (/mcp) and the JSON API (/api/*),
// and runs the hourly cron that refreshes trending stats into KV. State lives on Cloudflare, so any
// machine (or CI) with the right credentials sees the same deployment.
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

export const Stats = Cloudflare.KV.Namespace("Stats");

export const Website = Cloudflare.Website.Astro("Website", {
  rootDir: "site",
  main: "./src/worker.ts", // wraps Astro's handler to add the scheduled() cron
  crons: ["17 * * * *"], // hourly; each run refreshes the 24 stalest libraries (free-plan subrequest limit)
  sessionKVBindingName: false, // no Astro sessions; nothing to provision
  env: {
    STATS: Stats,
    // Fine-grained GitHub token, public repositories read-only. Unauthenticated calls from
    // Cloudflare's shared egress IPs hit GitHub's 60/hour limit.
    STATS_GITHUB_TOKEN: Config.Redacted("STATS_GITHUB_TOKEN"),
  },
});

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
  "tastebase",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* Website;
    return { url: site.url };
  }),
);
