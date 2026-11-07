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

    // Only what alchemy.run.ts needs: Workers with assets, cron, KV and logs, plus the remote state store.
    const ci = yield* Cloudflare.ApiToken.AccountApiToken("CIToken", {
      accountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: ["Workers Scripts Write", "Workers KV Storage Write", "Account Settings Write", "Workers Tail Read"],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        },
      ],
    });

    yield* GitHub.Secret("cf-api-token", { ...repo, name: "CLOUDFLARE_API_TOKEN", value: ci.value });
    yield* GitHub.Secret("stats-github-token", { ...repo, name: "STATS_GITHUB_TOKEN", value: yield* Config.Redacted("STATS_GITHUB_TOKEN") });
    yield* GitHub.Variable("cf-account-id", { ...repo, name: "CLOUDFLARE_ACCOUNT_ID", value: accountId });
    yield* GitHub.Variable("deploy-enabled", { ...repo, name: "DEPLOY_ENABLED", value: "true" });

    yield* GitHub.Label("preview-label", { ...repo, name: "preview", color: "5b7cff", description: "Deploy this PR to its own pr-<n> stage" });
    yield* GitHub.Label("library-label", { ...repo, name: "library", color: "3ecf8e", description: "Adds or changes a registry entry" });

    return { ciTokenName: ci.name };
  }),
);
