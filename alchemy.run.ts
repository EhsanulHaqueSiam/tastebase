// The tastebase app stack. Everything that runs in production is declared here; GitHub-side setup
// (CI token, secrets, variables, labels) lives in stacks/github.ts. See docs/operations/deploy.md.
//
//   pnpm dev            local: Astro dev server, SSR in workerd, local KV (stage dev_$USER)
//   pnpm run deploy     production (stage prod) from a laptop
//   CI                  push to main -> prod, PR labelled `preview` -> pr-<n>
//
// One Worker serves the site, the hosted MCP endpoint (/mcp) and the JSON API (/api/*), and runs the
// hourly cron that refreshes trending stats into KV. State lives on Cloudflare (Cloudflare.state()),
// so laptops and CI see the same deployments.
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import { Stack } from "alchemy/Stack";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import path from "node:path";

export const Stats = Cloudflare.KV.Namespace("Stats");

export const Website = Cloudflare.Website.Astro(
  "Website",
  Stack.useSync(({ stage }) => ({
    // prod: tastebase.<account>.workers.dev; every other stage gets its own suffixed Worker.
    name: stage === "prod" ? "tastebase" : `tastebase-${stage.replace(/[^a-z0-9-]/g, "-")}`,
    // Absolute paths: `alchemy dev` resolves a relative rootDir/main against the wrong base.
    rootDir: path.join(import.meta.dirname, "site"),
    main: path.join(import.meta.dirname, "site/src/worker.ts"), // Astro's handler + scheduled()
    crons: ["17 * * * *"], // hourly; each run refreshes the 24 stalest libraries (free-plan subrequest limit)
    sessionKVBindingName: false, // no Astro sessions; nothing to provision
    observability: { enabled: true }, // Workers Logs; follow with `pnpm logs`
    // Optional custom domain for prod, e.g. TASTEBASE_DOMAIN=tastebase.dev (the zone must be on this account).
    domain: stage === "prod" ? process.env.TASTEBASE_DOMAIN || undefined : undefined,
    env: {
      STATS: Stats,
      // Fine-grained GitHub token, public repositories read-only. Unauthenticated calls from
      // Cloudflare's shared egress IPs hit GitHub's 60/hour limit.
      STATS_GITHUB_TOKEN: Config.Redacted("STATS_GITHUB_TOKEN"),
    },
  })),
);

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
  "tastebase",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* Website;
    const stats = yield* Stats;
    return { url: site.url, workerName: site.workerName, statsNamespaceId: stats.namespaceId };
  }),
);
