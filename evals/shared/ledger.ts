// The recorded result of every case, and the rule that decides what has to run again.
//
// An eval has two steps. A sample is a paid agent run, kept in the cache under its own stamp. Grading reads kept
// samples and costs nothing, or a cent for a judge call. So each record keeps two fingerprints:
//   fp      what the agent read: its inputs, the tool schemas and instructions, and tastebase's answers to every
//           call any of its samples made. Replaying those calls against this checkout is free.
//   graded  what the grading read: the checks, the registry fields they use, the probe, the judge.
// When only `graded` moved, the samples the record rests on are graded again, and nothing is drawn unless that moves
// the verdict, which one more sample then has to confirm. When `fp` moved, new samples are drawn. Only drawing costs
// agent runs.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/mcp.ts";
import { aesthetics, libraries } from "../../src/registry/index.ts";
import { cache, root } from "./agent.ts";

/** `record: false` runs and reports without writing the baseline, as for another model or judge. */
export type Flags = { case: string[]; model?: string; record?: boolean; check: boolean; force: boolean; accept: boolean; jobs: number };
export type TbCall = [tool: string, args: Record<string, unknown>];
/** One paid run: its stamp in the cache, the tastebase calls it made, and what it cost. */
export type Sample = { stamp: string; calls: TbCall[]; usd: number };
/**
 * A sample graded. A failure reads "<check>" or "<check>: <detail>"; the part before the colon names the check, so a
 * detail that varies between samples is not a new failure. `note` is only printed. `usd` is what grading cost.
 */
export type Graded = { fails: string[]; info?: Record<string, unknown>; note?: string; usd?: number };
/** A recorded result. `samples` are the stamps it rests on; `worse` names checks that got worse and nobody accepted. */
export type Entry = { pass: boolean; fails: string[]; info?: Record<string, unknown>; calls: TbCall[]; samples: string[]; fp: string; graded: string; worse?: string[] };
type Baseline = { model: string; cases: Record<string, Entry> };

/**
 * Thrown by `grade` when a kept sample is no longer in the cache. Only this makes the ledger draw a new sample in its
 * place; any other grading error (a judge outage, Chrome missing) stops the case, since a new sample would fail the same way.
 */
export class Gone extends Error {}

export type Eval<C extends { id: string }> = {
  name: string;
  cases: C[];
  /** The model results are recorded for, by full id. */
  model: string;
  /** What a sample depends on besides tastebase's answers. */
  agent: (c: C) => unknown;
  /** What grading depends on. */
  grader: (c: C) => unknown;
  /** Draws one paid sample. `n` is 0 for the first, then 1 and 2 when the result is drawn again. */
  run: (c: C, model: string, n: number) => Promise<Sample>;
  /** Grades a kept sample. Throws `Gone` when the sample is no longer in the cache, and a fresh one is drawn instead. */
  grade: (c: C, model: string, stamp: string) => Promise<Graded>;
  /** `false` for an eval no agent reads tastebase in, so tool text cannot make it stale. */
  replay?: boolean;
  /** Where baseline.json lives, and unfinished samples too; tests point it elsewhere. */
  dir?: string;
};

/** Run `fn` over `items`, `n` at a time. */
export async function pool<T>(n: number, items: T[], fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()!); }));
}

export const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);

/** Replays tastebase calls in memory and hashes everything an agent would read for them. */
export async function surface() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(libraries, aesthetics, "eval").connect(a);
  const client = new Client({ name: "eval", version: "0" });
  await client.connect(b);
  const head = JSON.stringify((await client.listTools()).tools) + client.getInstructions();
  const answer = ([name, args]: TbCall) => client.callTool({ name, arguments: args }).then(JSON.stringify, String);
  return async (key: unknown, calls: TbCall[]) => hash([key, head, await Promise.all(calls.map(answer))]);
}

const check = (fail: string) => fail.split(": ")[0]!;
const checks = (g: Pick<Graded, "fails">) => new Set(g.fails.map(check));
const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

/**
 * The verdict over graded samples: a check counts as failing when most of them failed it, so one odd sample can
 * neither add a failure nor clear one. Its detail and info come from the last sample that agrees with the verdict.
 */
export function vote(graded: Graded[]) {
  const failing = new Set(graded.flatMap((g) => [...checks(g)]).filter((f) => graded.filter((g) => checks(g).has(f)).length * 2 > graded.length));
  const fails = [...failing].map((f) => graded.findLast((g) => checks(g).has(f))!.fails.find((x) => check(x) === f)!);
  const { info, note } = graded.findLast((g) => same(checks(g), failing)) ?? graded.at(-1)!;
  return { failing, fails, info, note };
}

/**
 * Brings every case of one eval up to date and prints one line per case. `problems` counts cases that got worse and
 * were not accepted, runs that broke, and with `--check` cases that are stale. `cases` is every result this run
 * stands on: the baseline, or for an unrecorded run only what it ran.
 */
export async function ledger<C extends { id: string }>(e: Eval<C>, flags: Flags) {
  const file = join(e.dir ?? join(root, "evals", e.name), "baseline.json");
  const base: Baseline = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { model: e.model, cases: {} };
  const model = flags.model ?? base.model;
  const recorded = model === base.model && flags.record !== false;
  const fingerprint = e.replay === false ? async (k: unknown) => hash(k) : await surface();
  const fresh: Record<string, Entry> = {};
  const say = (c: C, status: string, r?: Pick<Graded, "fails" | "note">) =>
    console.log(`${status.padEnd(20)} ${e.name}/${c.id}${r?.note ? `  ${r.note}` : ""}${r?.fails.map((f) => `\n${" ".repeat(23)}✗ ${f}`).join("") ?? ""}`);
  let problems = 0, usd = 0;

  await pool(flags.jobs, e.cases.filter((c) => !flags.case.length || flags.case.includes(c.id)), async (c) => {
    // An unrecorded run with the recorded builder (another judge, say) still regrades the recorded samples.
    const prior = model === base.model ? base.cases[c.id] : undefined;
    const fp = (calls: TbCall[]) => fingerprint([model, e.agent(c)], calls);
    const graded = hash([e.grader(c)]);
    const current = !!prior && prior.fp === (await fp(prior.calls));
    // A recorded regression stays one until the text changes or someone accepts it. Running it again, even with
    // --force, cannot clear it: that would make a flaky regression a lottery.
    if (current && prior.graded === graded && prior.worse) {
      if (!flags.accept || flags.check || !recorded) return problems++, say(c, "REGRESSED (cached)", prior);
      base.cases[c.id] = { ...prior, worse: undefined };
      return say(c, "fail (accepted)", prior);
    }
    if (current && prior.graded === graded && !flags.force) return say(c, prior.pass ? "pass (cached)" : "known fail (cached)", prior);
    if (flags.check) return problems++, say(c, !prior ? "never run" : current ? "stale (regrade, free)" : "stale");

    // The failing checks the record stands by. With --accept that includes the ones it got worse on: they are agreed now.
    const agreed = new Set(prior?.fails.map(check).filter((f) => flags.accept || !prior.worse?.includes(f)));
    const samples: Sample[] = [], results: Graded[] = [];
    // Paid samples whose grading broke last time (a judge outage, say) are graded before anything new is bought, as
    // long as they were drawn from what the agent reads now. Only a recorded run uses them up: a comparison must not.
    const pendingFile = join(e.dir ? join(e.dir, "pending") : join(cache, "pending", e.name, model), `${c.id}.json`);
    const pending: { fp: string; sample: Sample }[] = recorded && existsSync(pendingFile) ? JSON.parse(readFileSync(pendingFile, "utf8")) : [];
    const drawn: { fp: string; sample: Sample }[] = [];
    // The next sample of a fresh run: a pending one if it still applies, otherwise a new one.
    const next = async (): Promise<Set<string>> => {
      for (let p = pending.shift(); p; p = pending.shift()) {
        if (p.fp !== (await fp(p.sample.calls))) continue;
        try {
          const g = await e.grade(c, model, p.sample.stamp);
          samples.push({ ...p.sample, usd: 0 });
          drawn.push(p);
          results.push(g);
          return checks(g);
        } catch (err) {
          if (!(err instanceof Gone)) throw (pending.unshift(p), err); // still pending: the outage is not over
        }
      }
      const sample = await e.run(c, model, samples.length);
      samples.push(sample);
      drawn.push({ fp: await fp(sample.calls), sample });
      const g = await e.grade(c, model, sample.stamp);
      results.push(g);
      return checks(g);
    };
    try {
      // Only the grading moved: grade the samples the record rests on again, one at a time since they may share files.
      if (prior?.samples?.length && current && !flags.force)
        try {
          for (const stamp of prior.samples) {
            results.push(await e.grade(c, model, stamp));
            samples.push({ stamp, calls: prior.calls, usd: 0 });
          }
        } catch (err) {
          if (!(err instanceof Gone)) throw err;
          samples.length = results.length = 0;
        }
      if (!results.length) {
        // A sample that matches the record settles the case at once, the cheap and common path. One that differs is
        // drawn again, and a third time if those two differ; then each check is decided by majority.
        const first = await next();
        if (!same(first, agreed) && !same(await next(), first)) await next();
      } else if (recorded && results.length < 3 && !same(vote(results).failing, agreed)) {
        // A regrade that moves the verdict is held to the same rule as a new sample: one more has to agree with it,
        // and a third decides when that one does not. A comparison that records nothing (another judge) only reports
        // the regrade, since confirming it would buy pages nobody keeps.
        const verdict = vote(results).failing;
        if (!same(await next(), verdict) && results.length < 3) await next();
      }
      if (recorded) rmSync(pendingFile, { force: true });
    } catch (err) {
      if (recorded && (drawn.length || pending.length)) {
        mkdirSync(join(pendingFile, ".."), { recursive: true });
        // What was drawn this time and what is still waiting; a pending sample that turned out to be gone is dropped.
        writeFileSync(pendingFile, JSON.stringify([...drawn.filter((d) => !pending.includes(d)), ...pending]));
      }
      // A run that broke (no login, usage limit, Chrome missing) says nothing about tastebase, so it is never recorded.
      return problems++, say(c, "ERROR (not recorded)", { fails: [(err as Error).message] });
    } finally {
      usd += samples.reduce((s, x) => s + x.usd, 0) + results.reduce((s, g) => s + (g.usd ?? 0), 0);
    }
    const { failing, fails, info, note } = vote(results);
    // The record rests on every sample, so its fingerprint holds every answer any of them read.
    const calls = [...new Map(samples.flatMap((s) => s.calls).map((call) => [JSON.stringify(call), call])).values()];
    const worse = [...failing].filter((f) => !agreed.has(f));
    const regressed = worse.length > 0 && !!prior && !flags.accept;
    if (regressed) problems++;
    const entry: Entry = { pass: !failing.size, fails, info, calls, samples: samples.map((s) => s.stamp), fp: await fp(calls), graded, worse: regressed ? worse : undefined };
    if (recorded) base.cases[c.id] = entry;
    else fresh[c.id] = entry;
    const better = [...agreed].some((f) => !failing.has(f));
    const status = !failing.size ? (prior && !prior.pass ? "pass (fixed)" : "pass") : regressed ? "REGRESSED" : worse.length && prior ? "fail (accepted)" : !prior ? "fail (new)" : better ? "known fail (better)" : "known fail";
    say(c, status, { fails, note });
  });

  if (!flags.check && recorded) {
    // One line per case, in case order, so the diff of this file is the list of results that changed.
    const lines = e.cases.flatMap((c) => (base.cases[c.id] ? [`    ${JSON.stringify(c.id)}: ${JSON.stringify(base.cases[c.id])}`] : []));
    writeFileSync(file, `{\n  "model": ${JSON.stringify(base.model)},\n  "cases": {\n${lines.join(",\n")}\n  }\n}\n`);
  }
  if (usd) console.log(`${e.name}: $${usd.toFixed(3)} on ${model}`);
  return { problems, cases: recorded ? base.cases : fresh };
}
