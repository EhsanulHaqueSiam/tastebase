// GitHub-side infrastructure for CI. Run once from a laptop, and again only to rotate or change it:
//
//   GITHUB_ACCESS_TOKEN="$(gh auth token)" sh scripts/with-env.sh pnpm alchemy deploy --config stacks/github.ts --stage prod
//
// Cloudflare: your normal OAuth profile works if "Account API Token Provisioning" was enabled at sign-in;
// otherwise use a profile holding an API token with Account API Tokens write. GitHub: the env var above.
// It mints a Cloudflare API token scoped to what alchemy.run.ts deploys, and stores everything the
// workflows in .github/workflows read. Setting DEPLOY_ENABLED is what switches the deploy workflows on.
// Not declared (paid for private repos on GitHub Free): deployment environments with required reviewers
// and branch protection. Add GitHub.Environment / GitHub.BranchProtection here when the repo is public or on Pro.
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const repo = { owner: "EhsanulHaqueSiam", repository: "tastebase" };

export default Alchemy.Stack(
  "tastebase-github",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const { accountId } = yield* yield* Cloudflare.CloudflareEnvironment;

    // Only what alchemy.run.ts needs: Workers with assets, cron, KV, D1 and logs, plus the remote state store
    // (its auth token sits in the Secrets Store; binding it into the preview worker that reads it needs Write).
    const ci = yield* Cloudflare.ApiToken.AccountApiToken("CIToken", {
      accountId,
      policies: [
        {
          effect: "allow",
          // Turnstile and Email Routing Addresses: the forms' captcha widget and the verified inbox (alchemy.run.ts).
          permissionGroups: ["Workers Scripts Write", "Workers KV Storage Write", "D1 Write", "Account Settings Write", "Workers Tail Read", "Secrets Store Write", "Turnstile Sites Write", "Email Routing Addresses Write"],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        },
      ],
    });

    // Read-only, for the Worker's cron to query agent-use counts from Analytics Engine (src/trending.ts fetchUsage).
    const usage = yield* Cloudflare.ApiToken.AccountApiToken("UsageReadToken", {
      accountId,
      policies: [{ effect: "allow", permissionGroups: ["Account Analytics Read"], resources: { [`com.cloudflare.api.account.${accountId}`]: "*" } }],
    });

    yield* GitHub.Secret("cf-api-token", { ...repo, name: "CLOUDFLARE_API_TOKEN", value: ci.value });
    yield* GitHub.Secret("usage-api-token", { ...repo, name: "USAGE_API_TOKEN", value: usage.value });
    yield* GitHub.Secret("stats-github-token", { ...repo, name: "STATS_GITHUB_TOKEN", value: yield* Config.Redacted("STATS_GITHUB_TOKEN") });
    // The forms' inbox and sender (alchemy.run.ts). Secrets, not variables, so the inbox address stays private.
    if (process.env.FORMS_TO && process.env.FORMS_FROM) {
      yield* GitHub.Secret("forms-to", { ...repo, name: "FORMS_TO", value: yield* Config.Redacted("FORMS_TO") });
      yield* GitHub.Secret("forms-from", { ...repo, name: "FORMS_FROM", value: yield* Config.Redacted("FORMS_FROM") });
    }
    // GitHub sign-in on the site (alchemy.run.ts authEnv): the OAuth app's keys and better-auth's signing secret.
    yield* GitHub.Secret("auth-github-id", { ...repo, name: "AUTH_GITHUB_ID", value: yield* Config.Redacted("AUTH_GITHUB_ID") });
    yield* GitHub.Secret("auth-github-secret", { ...repo, name: "AUTH_GITHUB_SECRET", value: yield* Config.Redacted("AUTH_GITHUB_SECRET") });
    yield* GitHub.Secret("better-auth-secret", { ...repo, name: "BETTER_AUTH_SECRET", value: yield* Config.Redacted("BETTER_AUTH_SECRET") });
    yield* GitHub.Variable("cf-account-id", { ...repo, name: "CLOUDFLARE_ACCOUNT_ID", value: accountId });
    yield* GitHub.Variable("deploy-enabled", { ...repo, name: "DEPLOY_ENABLED", value: "true" });

    yield* GitHub.Label("preview-label", { ...repo, name: "preview", color: "5b7cff", description: "Deploy this PR to its own pr-<n> stage" });
    yield* GitHub.Label("library-label", { ...repo, name: "library", color: "3ecf8e", description: "Adds or changes a registry entry" });
    yield* GitHub.Label("picks-label", { ...repo, name: "picks", color: "f5b041", description: "plan or pick recommends the wrong library" });

    return { ciTokenName: ci.name };
  }),
);
