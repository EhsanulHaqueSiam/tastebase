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

// Forms (/submit, /feedback, /sponsor) email the admin. Cloudflare's free plan only sends from a domain with Email Routing
// to a verified address, so both come from .env (CI: repo variables): FORMS_FROM, e.g. tastebase@<a routing zone>, and
// FORMS_TO, the admin inbox. Without them the forms answer "not set up" and nothing else changes.
const formsFrom = process.env.FORMS_FROM, formsTo = process.env.FORMS_TO;
const forms = !!(formsFrom && formsTo);
export const FormsInbox = Cloudflare.Email.Address("FormsInbox", { email: formsTo ?? "" });
export const FormsMail = Cloudflare.Email.SendEmail("FormsMail", { destinationAddress: formsTo, allowedSenderAddresses: formsFrom ? [formsFrom] : [] });
// Turnstile on the forms. Subdomains are covered, so one widget serves prod and every pr-<n> preview of a stage.
export const FormsCaptcha = Cloudflare.Turnstile.Widget("FormsCaptcha", {
  domains: ["ehsanulsiam.workers.dev", ...(process.env.TASTEBASE_DOMAIN ? [process.env.TASTEBASE_DOMAIN] : [])],
  mode: "managed",
});
// Cloudflare's always-pass test keys, for laptops (a real widget would need localhost on its domain list).
const TEST_CAPTCHA = { TURNSTILE_SITEKEY: "1x00000000000000000000AA", TURNSTILE_SECRET: "1x0000000000000000000000000000000AA" };

export const Website = Cloudflare.Website.Astro(
  "Website",
  Stack.useSync(({ stage }) => {
    // Agent uses per library (src/trending.ts fetchUsage). Previews and laptops share one dataset so prod stays clean.
    const usageDataset = stage === "prod" ? "tastebase_usage" : "tastebase_usage_dev";
    return {
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
      USAGE: Cloudflare.AnalyticsEngine.Dataset("Usage", { dataset: usageDataset }),
      // Workers AI for /api/match: a vision model describes a dropped screenshot (free daily allocation).
      AI: Cloudflare.Workers.AI(),
      USAGE_DATASET: usageDataset,
      // Reading the counts back needs an Account Analytics Read token (minted in stacks/github.ts for CI) and the
      // account id. Both are optional: without them the cron skips usage and everything else runs.
      ...(process.env.USAGE_API_TOKEN && { USAGE_API_TOKEN: Config.Redacted("USAGE_API_TOKEN") }),
      ...(process.env.CLOUDFLARE_ACCOUNT_ID && { CF_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID }),
      ...(stage.startsWith("dev") ? TEST_CAPTCHA : { TURNSTILE_SITEKEY: Effect.map(FormsCaptcha, (w) => w.sitekey), TURNSTILE_SECRET: Effect.map(FormsCaptcha, (w) => w.secret) }),
      // Under `alchemy dev` the mail binding writes .eml files to .alchemy/local/email instead of sending.
      MAIL: FormsMail,
      FORMS_FROM: formsFrom ?? "",
      FORMS_TO: formsTo ?? "", // empty: the forms answer "not set up"
    },
  };
  }),
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
    // Registering the inbox makes Cloudflare email it a verification link once; the binding can send only after that.
    if (forms && (yield* Alchemy.Stage) === "prod") yield* FormsInbox;
    return { url: site.url, workerName: site.workerName, statsNamespaceId: stats.namespaceId };
  }),
);
