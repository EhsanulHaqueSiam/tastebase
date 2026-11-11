// pnpm eval [mcp-tool-use|skill|design|usage ...] [--case a,b] [--model m] [--judge m] [--check] [--force] [--accept]
// With no name it runs all four. Only what changed costs anything; see README.md.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { briefs } from "./design/briefs.ts";
import { agentInputs, sample } from "./design/design.ts";
import { gradeBuild, grading, review, summary } from "./design/grade.ts";
import { cases as mcpCases } from "./mcp-tool-use/cases.ts";
import { cache, project, runAgent, skillFile, sources, type Trace } from "./shared/agent.ts";
import { evidence, grade, type Case } from "./shared/checks.ts";
import { Gone, ledger, type Eval, type Flags } from "./shared/ledger.ts";
import { cases as skillCases } from "./skill/cases.ts";
import { checkUsage, snippets } from "./usage/usage.ts";

// Full ids, not aliases: an alias moves to a new model without anything here changing, and the record would go quietly out of date.
const AGENT = "claude-haiku-5-5", JUDGE = "claude-sonnet-5-5";
const { values: v, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    case: { type: "string" }, model: { type: "string" }, judge: { type: "string", default: JUDGE }, jobs: { type: "string" },
    check: { type: "boolean", default: false }, force: { type: "boolean", default: false }, accept: { type: "boolean", default: false }, review: { type: "boolean", default: false },
    // For pnpm check: report stale design results without failing, since bringing them up to date may cost a run.
    warn: { type: "boolean", default: false },
  },
});
// Results are recorded for the default builder and judge only; any other is a comparison, reported and not kept.
const flags = (jobs: number): Flags => ({ case: v.case?.split(",") ?? [], model: v.model, record: v.judge === JUDGE, check: v.check, force: v.force, accept: v.accept, jobs: Number(v.jobs ?? jobs) });

/**
 * An eval graded on what the agent did: its tool calls, the commands it tried and the files it wrote. Every trace is
 * kept, so a changed check grades the kept traces again instead of running the agent.
 */
function traces(name: string, cases: Case[], skill: boolean, ...caseFiles: string[]): Eval<Case> {
  const kept = (model: string, c: Case, stamp: string) => join(cache, name, model, c.id, `${stamp}.json`);
  return {
    name, cases, model: AGENT,
    agent: (c) => [sources("evals/shared/agent.ts"), c.prompt, c.files, c.turns ?? 8, skill && readFileSync(skillFile, "utf8")],
    // The case files hold the checks, which are code.
    grader: (c) => [sources("evals/shared/checks.ts", ...caseFiles), evidence, c.id],
    run: async (c, model) => {
      const dir = project(c.files, skill);
      const t = await runAgent({ dir, prompt: c.prompt, model, tastebase: true, skill, turns: c.turns ?? 8 }).finally(() => rmSync(dir, { recursive: true, force: true }));
      if (t.error) throw new Error(t.error);
      const stamp = randomUUID(), file = kept(model, c, stamp);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(t, null, 2));
      return { stamp, calls: t.calls.filter((x) => x.tastebase).map((x) => [x.name, x.input]), usd: t.usd };
    },
    grade: async (c, model, stamp) => {
      const file = kept(model, c, stamp);
      if (!existsSync(file)) throw new Gone(`trace ${stamp} is no longer in the cache`);
      const t = JSON.parse(readFileSync(file, "utf8")) as Trace, fails = grade(t, c.expect);
      return { fails, note: fails.length ? `trace: ${file}${t.capped ? ` (stopped at the ${c.turns ?? 8}-turn cap)` : ""}` : undefined };
    },
  };
}

const evals = {
  "mcp-tool-use": () => ledger(traces("mcp-tool-use", mcpCases, false, "evals/mcp-tool-use/cases.ts"), flags(4)),
  skill: () => ledger(traces("skill", [...mcpCases, ...skillCases], true, "evals/mcp-tool-use/cases.ts", "evals/skill/cases.ts"), flags(4)),
  design: async () => {
    const r = await ledger(
      { name: "design", cases: briefs, model: AGENT, agent: (b) => agentInputs(b, "with"), grader: (b) => grading(b, v.judge), run: (b, model, n) => sample(b, model, n, v.force), grade: (b, model, stamp) => gradeBuild(b, model, stamp, v.judge) },
      { ...flags(2), check: v.check || v.warn },
    );
    console.log(summary(r.cases, briefs, v.model ?? AGENT, v.judge));
    // A warning only: the design eval is run on purpose, before a release or after a look changes.
    return v.warn ? { ...r, problems: 0 } : r;
  },
  // No model: each library's `usage` imports are typechecked against the package they name. Its result depends on
  // the published package, which no fingerprint here can see: a scheduled workflow re-runs it with --force
  // (.github/workflows/usage.yml).
  usage: () =>
    ledger(
      { name: "usage", cases: snippets, model: "none", replay: false, agent: (s) => s, grader: () => sources("evals/usage/usage.ts"), run: async (s) => ({ stamp: s.id, calls: [], usd: 0 }), grade: (s) => checkUsage(s) },
      flags(6),
    ),
};

if (v.review) {
  const baseline = join(import.meta.dirname, "design", "baseline.json");
  console.log(review(existsSync(baseline) ? JSON.parse(readFileSync(baseline, "utf8")).cases : {}, briefs, AGENT));
} else {
  const names = positionals.length ? positionals : Object.keys(evals);
  let problems = 0;
  for (const name of names) {
    if (!(name in evals)) throw new Error(`no eval named "${name}"; there are ${Object.keys(evals).join(", ")}`);
    problems += (await evals[name as keyof typeof evals]()).problems;
  }
  if (problems) console.log(v.check ? `\n${problems} recorded results are stale or regressed. Run \`pnpm eval ${names.join(" ")}\`.` : `\n${problems} cases got worse or could not run. Fix them, or record a loss on purpose with --accept.`);
  process.exit(problems ? 1 : 0);
}
