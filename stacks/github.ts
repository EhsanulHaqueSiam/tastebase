// One-off stack: mints a scoped Cloudflare API token for CI and stores it, with the account id and the
// stats token, as GitHub Actions secrets. Run from a laptop with an admin profile, and again only to rotate:
//   alchemy deploy --config stacks/github.ts --profile admin
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

const repo = { owner: "EhsanulHaqueSiam", repository: "tastebase" };

export default Alchemy.Stack(
  "tastebase-github",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const { accountId } = yield* yield* Cloudflare.CloudflareEnvironment;

    // Only what alchemy.run.ts deploys: a Worker with assets, cron and KV, plus the remote state store.
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
    yield* GitHub.Secret("cf-account-id", { ...repo, name: "CLOUDFLARE_ACCOUNT_ID", value: Redacted.make(accountId) });
    yield* GitHub.Secret("stats-github-token", { ...repo, name: "STATS_GITHUB_TOKEN", value: yield* Config.Redacted("STATS_GITHUB_TOKEN") });
    // The deploy workflow stays skipped until this exists, so CI never fails for missing secrets.
    yield* GitHub.Variable("deploy-enabled", { ...repo, name: "DEPLOY_ENABLED", value: "true" });
  }),
);
