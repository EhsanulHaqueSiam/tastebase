// Grades kept design builds and reports on them. A build is the agent's page as it left it (`dist`), with what it
// read and wrote. Grading probes the page, asks the judge about its screenshots, compares it with the build
// without tastebase, and applies the checks. Each of those is cached in the build by what decides it, so a change to
// one of them redoes only that step: the probe and the checks are free, a judge call costs about a cent.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aesthetics, libraries } from "../../src/registry/index.ts";
import { aestheticIds, type AestheticId, type Kind } from "../../src/registry/schema.ts";
import { chromium } from "../../scripts/chromium.ts";
import { cache, claude, sources, type Files } from "../shared/agent.ts";
import { evidence, foundation, offers, used } from "../shared/checks.ts";
import { Gone, hash, type Entry, type Graded, type TbCall } from "../shared/ledger.ts";
import type { Brief } from "./briefs.ts";
import { inspect, type Probe } from "./page.ts";

export type Arm = "with" | "without";
export type Look = AestheticId | "none";
type Judged = { look: Look; score: number };
/**
 * One built page, kept in `<cache>/design/<model>/<brief>/<arm>/<stamp>/` with its `dist`. `agent` says what it was
 * built from. A build with tastebase names the build without it that it is compared with (`opponent`). `probe` and
 * `judged` are filled in by grading and keyed by what decided them.
 */
export type Build = {
  stamp: string;
  agent: string;
  built: boolean;
  calls: TbCall[];
  /** What the agent left behind that shows which libraries it used: its source files and the commands it ran. */
  files: Files;
  commands: string[];
  opponent?: string;
  probe?: { key: string; desktop: Probe; mobile: Probe; reduced: Probe };
  judged?: Record<string, Judged>;
};
export type Verdict = { winner: "A" | "B" | "tie"; why: string };
/** The judge's two verdicts on a pair of builds, and which arm it saw first as A. */
export type Pair = { a: Arm; first: Verdict; second: Verdict; better: Arm | "tie" };
/**
 * What is recorded for a brief besides pass or fail. `faults` counts the checks both builds face, so the two arms
 * compare like for like. `needed` and `adopted` count the kinds of library the brief calls for, and how many of
 * them the page met with one tastebase offered. `stamp` and `opponent` name the builds behind the numbers.
 */
export type Info = {
  look?: Look; score?: number; libs: string[]; faults: number; needed: number; adopted: number; better: Arm | "tie";
  stamp: string; opponent: string; pair?: string;
  without: { look?: Look; score?: number; libs: string[]; faults: number };
};

export const builds = (model: string, id: string) => join(cache, "design", model, id);
export const dirOf = (model: string, id: string, arm: Arm, stamp: string) => join(builds(model, id), arm, stamp);
export const load = (dir: string): Build | undefined => (existsSync(join(dir, "build.json")) ? JSON.parse(readFileSync(join(dir, "build.json"), "utf8")) : undefined);
const save = (dir: string, x: Build) => writeFileSync(join(dir, "build.json"), JSON.stringify(x, null, 2));
export const selectors = (b: Brief) => Object.values(b.has ?? {}).filter((v) => typeof v === "string");
/** A brief as text, patterns included, for a fingerprint. */
export const stable = (b: Brief) => JSON.stringify(b, (_, v) => (v instanceof RegExp ? String(v) : v));

// The judge's questions. They are part of what grading depends on, so changing one asks the judge again.
const lookQuestion = `Read desktop.png and mobile.png: two screenshots of one web page. Which of these looks does it show? Answer none when it is a plain page with no clear look.\n\n${aesthetics.map((a) => `${a.id}: ${a.summary}`).join("\n")}\n\nThen score how well it is made, 1 to 10, as a senior product designer would for shipped work: 10 is flawless, 7 is solid but generic, 4 has clear problems.`;
const compareQuestion = (brief: string) => `Two builds, A and B, of this brief:\n\n${brief}\n\nRead a-desktop.png, a-mobile.png, b-desktop.png and b-mobile.png: a desktop and a phone screenshot of each. As a senior product designer, which build fits the brief better and is better made? Say why in one sentence.`;
const PROBE = [sources("evals/design/page.ts"), chromium];
/** Everything grading depends on besides the builds themselves. */
// The look question is built from the looks' summaries in the registry, so it is hashed as asked, not as written here.
export const grading = (b: Brief, judge: string) => [sources("evals/design/grade.ts", "evals/shared/checks.ts"), evidence, PROBE, judge, lookQuestion, stable(b)];

// How the judge is run. Part of every judge cache key, so changing it asks the judge again.
const JUDGE = ["--effort", "low", "--max-turns", "8", "--setting-sources", "", "--strict-mcp-config", "--tools", "Read", "--allowedTools", "Read", "--system-prompt", "You judge screenshots of web pages. Read every image named in the request before answering."];

/** One structured answer from a model that may only read the images in `cwd`. */
async function ask<T>(cwd: string, model: string, question: string, properties: Record<string, object>): Promise<{ answer: T; usd: number }> {
  const schema = { type: "object", properties, required: Object.keys(properties) };
  const out = await claude(["--model", model, ...JUDGE, "--json-schema", JSON.stringify(schema), "--output-format", "json"], question, cwd, 180_000);
  const r = JSON.parse(out) as { structured_output?: T; total_cost_usd?: number; result?: string };
  if (!r.structured_output) throw new Error(`judge gave no answer: ${String(r.result).slice(0, 200)}`);
  return { answer: r.structured_output, usd: r.total_cost_usd ?? 0 };
}

const probeKeyOf = (b: Brief) => hash([PROBE, selectors(b), b.click ?? null]);
const lookKey = (b: Brief, judge: string) => hash([judge, JUDGE, lookQuestion, probeKeyOf(b)]);

/** Probes the build's page and names its look, unless that was already done with the same probe and judge. */
async function measure(b: Brief, dir: string, x: Build, judge: string): Promise<number> {
  if (!x.built) return 0;
  const probeKey = probeKeyOf(b);
  if (x.probe?.key !== probeKey) {
    if (!existsSync(join(dir, "dist"))) throw new Gone(`${dir} has no page to probe`);
    x.probe = { key: probeKey, ...(await inspect(join(dir, "dist"), dir, { selectors: selectors(b), click: b.click })) };
    save(dir, x);
  }
  // The judge sees only the pixels, not the brief: a page that was asked to be brutalist has to look it. The score is
  // for the craft alone, so it can be compared across briefs and over time.
  const judgeKey = lookKey(b, judge);
  if (x.judged?.[judgeKey]) return 0;
  const { answer, usd } = await ask<Judged>(dir, judge, lookQuestion, { look: { type: "string", enum: [...aestheticIds, "none"] }, score: { type: "integer", minimum: 1, maximum: 10 } });
  x.judged = { ...x.judged, [judgeKey]: answer };
  save(dir, x);
  return usd;
}
const judgedBy = (b: Brief, x: Build, judge: string) => x.judged?.[lookKey(b, judge)];

/** Which build is better, asked twice with the order swapped so the judge's lean towards A or B cannot decide it. */
async function compare(b: Brief, model: string, mine: Build, plain: Build, judge: string): Promise<{ pair: Pair; file: string; usd: number }> {
  // Keyed by the screenshots too: a new probe re-shoots both pages, and a verdict on the old shots no longer applies.
  const file = join(builds(model, b.id), "pairs", `${mine.stamp}-${plain.stamp}-${hash([judge, JUDGE, compareQuestion(b.brief), probeKeyOf(b)])}.json`);
  if (existsSync(file)) return { pair: JSON.parse(readFileSync(file, "utf8")), file, usd: 0 };
  const flip = (arm: Arm): Arm => (arm === "with" ? "without" : "with");
  const dirs = { with: dirOf(model, b.id, "with", mine.stamp), without: dirOf(model, b.id, "without", plain.stamp) };
  const once = async (asA: Arm) => {
    const tmp = mkdtempSync(join(tmpdir(), "tb-pair-"));
    for (const [letter, arm] of [["a", asA], ["b", flip(asA)]] as const) for (const size of ["desktop", "mobile"]) copyFileSync(join(dirs[arm], `${size}.png`), join(tmp, `${letter}-${size}.png`));
    const { answer, usd } = await ask<Verdict>(tmp, judge, compareQuestion(b.brief), { winner: { type: "string", enum: ["A", "B", "tie"] }, why: { type: "string" } }).finally(() => rmSync(tmp, { recursive: true, force: true }));
    return { answer, usd, arm: answer.winner === "tie" ? ("tie" as const) : answer.winner === "A" ? asA : flip(asA) };
  };
  // The first verdict is kept as soon as it is in, so an outage before the second does not pay for it twice.
  mkdirSync(join(builds(model, b.id), "pairs"), { recursive: true });
  const partial = `${file}.first`;
  const arm = (v: Verdict, asA: Arm) => (v.winner === "tie" ? ("tie" as const) : v.winner === "A" ? asA : flip(asA));
  let usd = 0;
  let half: { a: Arm; first: Verdict } | undefined = existsSync(partial) ? JSON.parse(readFileSync(partial, "utf8")) : undefined;
  if (!half) {
    const a: Arm = Math.random() < 0.5 ? "with" : "without", got = await once(a);
    half = { a, first: got.answer };
    usd += got.usd;
    writeFileSync(partial, JSON.stringify(half));
  }
  const second = await once(flip(half.a));
  usd += second.usd;
  const pair: Pair = { a: half.a, first: half.first, second: second.answer, better: arm(half.first, half.a) === second.arm ? second.arm : "tie" };
  writeFileSync(file, JSON.stringify(pair, null, 2));
  rmSync(partial, { force: true });
  return { pair, file, usd };
}

/** The registry libraries a build used, read from its files and commands the same way the trace evals read them. */
export const libsOf = (x: Pick<Build, "files" | "commands">) =>
  used({ calls: x.commands.map((command) => ({ name: "Bash", input: { command }, result: "", tastebase: false })), text: "", files: x.files, usd: 0 }, false);

/** For each kind of library the brief calls for: what tastebase offered for it and what the page used for that job. */
export function needs(b: Brief, x: Build) {
  const offered = offers(x.calls), libs = libsOf(x), kindOf = (id: string) => libraries.find((l) => l.id === id)?.kind;
  return (b.needs ?? []).map((kind: Kind) => {
    const options = offered.get(kind) ?? new Set<string>();
    // Offered for this job counts whatever its own kind; anything else counts when it is built for the job.
    const took = libs.filter((id) => options.has(id) || kindOf(id) === kind);
    return { kind, options: [...options], met: took.some((id) => options.has(id)), around: took.filter((id) => !options.has(id)) };
  });
}

/**
 * Why a build fails its brief. Empty means it passes. A failure reads "<check>: <detail>", and the check is the same
 * whatever the detail, so samples that fail it differently still vote together. `look` is what the judge named.
 * `planned` adds the checks that only make sense for the build that had tastebase: asking it, and using what it offered.
 */
export function faults(b: Brief, x: Build, look: Look | undefined, planned: boolean): string[] {
  if (!x.built || !x.probe) return ["does not build"];
  const { desktop, mobile, reduced } = x.probe;
  const both = [desktop, mobile];
  const kits = libsOf(x).filter((id) => foundation(libraries.find((l) => l.id === id)!));
  const jobs = needs(b, x);
  const around = jobs.filter((j) => j.options.length && j.around.length).map((j) => `${j.around.join(", ")} for ${j.kind}, tastebase offered ${j.options.join(", ")}`);
  const most = (n: (p: Probe) => number) => Math.max(...both.map(n));
  return [
    planned && !x.calls.length && "never asked tastebase",
    both.some((p) => p.text.length < 50) && "renders a blank page",
    both.some((p) => p.errors.length) && `throws on load: ${both.flatMap((p) => p.errors)[0]}`,
    desktop.overflow > 4 && `scrolls sideways at 1440px: ${desktop.overflow}px too wide`,
    mobile.overflow > 4 && `scrolls sideways at 390px: ${mobile.overflow}px too wide`,
    reduced.loops > 0 && `keeps looping under reduced motion: ${reduced.loops} animations`,
    kits.length > 1 && `mixes component kits: ${kits.join(", ")}`,
    !!b.look && look !== b.look && `reads as another look: ${look}, not ${b.look}`,
    b.limits?.accents !== undefined && most((p) => p.accents) > b.limits.accents && `too many accent colours: ${most((p) => p.accents)}, the look allows ${b.limits.accents}`,
    b.limits?.loops !== undefined && most((p) => p.loops) > b.limits.loops && `too many looping animations: ${most((p) => p.loops)}, the look allows ${b.limits.loops}`,
    ...Object.entries(b.has ?? {}).map(([label, want]) => {
      const missing = both.filter((p) => !(typeof want === "string" ? p.found[selectors(b).indexOf(want)] : want.test(p.text)));
      return missing.length > 0 && `is missing ${label}: ${missing.length === 2 ? "at both widths" : missing[0] === mobile ? "at 390px" : "at 1440px"}`;
    }),
    !!b.click && reduced.click !== "opens" && `pressing "${b.click}" opens nothing: the control is ${reduced.click === "dead" ? "dead" : "missing"}`,
    ...(planned ? jobs.map((j) => !j.met && `uses no ${j.kind} library tastebase offered: ${j.options[0] ?? "it never asked for one"}`) : []),
    planned && around.length > 0 && `goes around the plan: ${around.join("; ")}`,
  ].filter((f): f is string => !!f);
}

/** Grades one kept build with tastebase against the build without it that it was made next to. */
export async function gradeBuild(b: Brief, model: string, stamp: string, judge: string): Promise<Graded> {
  const mineDir = dirOf(model, b.id, "with", stamp), mine = load(mineDir);
  const plainDir = mine?.opponent ? dirOf(model, b.id, "without", mine.opponent) : "", plain = plainDir ? load(plainDir) : undefined;
  if (!mine || !plain) throw new Gone(`build ${stamp} of ${b.id} is no longer in the cache`);
  let usd = (await measure(b, mineDir, mine, judge)) + (await measure(b, plainDir, plain, judge));
  let better: Info["better"] = mine.built === plain.built ? "tie" : mine.built ? "with" : "without", pair: string | undefined;
  if (mine.built && plain.built) {
    const judged = await compare(b, model, mine, plain, judge);
    better = judged.pair.better;
    pair = judged.file;
    usd += judged.usd;
  }
  const [mineLook, plainLook] = [judgedBy(b, mine, judge), judgedBy(b, plain, judge)];
  const fails = [...faults(b, mine, mineLook?.look, true), ...(better === "without" ? ["the judge prefers the build without tastebase"] : [])];
  const jobs = needs(b, mine);
  const info: Info = {
    look: mineLook?.look, score: mineLook?.score, libs: libsOf(mine), faults: faults(b, mine, mineLook?.look, false).length, needed: jobs.length, adopted: jobs.filter((j) => j.met).length, better,
    stamp, opponent: plain.stamp, pair,
    without: { look: plainLook?.look, score: plainLook?.score, libs: libsOf(plain), faults: faults(b, plain, plainLook?.look, false).length },
  };
  return { fails, info, usd, note: `better: ${better}; build ${mineDir}` };
}

const reviewFile = (model: string) => join(cache, "design", model, "review.md");
// Which arm review.md showed as A for each brief, and which verdict file it showed. A pick only counts while the
// record still rests on that same pair; after a rebuild it is about pages you never saw.
const orderFile = (model: string) => join(cache, "design", model, "review", "order.json");
type Row = { b: Brief; info: Info };
/** Every recorded pair, and whether the judge agrees with your pick for it, when you have one for the same pair. */
function reviewed(rows: Row[], model: string) {
  // Each brief's section is read on its own, so a pick left blank cannot take the next brief's answer.
  const sections = existsSync(reviewFile(model)) ? readFileSync(reviewFile(model), "utf8").split(/^## /m).slice(1) : [];
  const picks = new Map(sections.flatMap((s) => {
    const m = /^pick: *(A|B|tie)\b/im.exec(s);
    return m ? [[s.split(/\s/)[0]!, m[1]!.toUpperCase()] as const] : [];
  }));
  const shown: Record<string, { a: Arm; pair: string }> = existsSync(orderFile(model)) ? JSON.parse(readFileSync(orderFile(model), "utf8")) : {};
  return rows.flatMap(({ b, info }) => {
    if (!info.pair || !existsSync(info.pair)) return [];
    const pair = JSON.parse(readFileSync(info.pair, "utf8")) as Pair, pick = picks.get(b.id), seen = shown[b.id];
    const same = seen?.pair === info.pair;
    const yours = pick && same && (pick === "TIE" ? "tie" : (pick === "A") === (seen.a === "with") ? "with" : "without");
    return [{ b, info, pair, agrees: yours ? yours === pair.better : undefined, stale: !!pick && !same }];
  });
}
const rowsOf = (cases: Record<string, Entry>, briefs: Brief[]): Row[] => briefs.flatMap((b) => (cases[b.id]?.info ? [{ b, info: cases[b.id]!.info as Info }] : []));

/** The numbers that answer "is the design better with tastebase", over every result given. */
export function summary(cases: Record<string, Entry>, briefs: Brief[], model: string, judge: string): string {
  const rows = rowsOf(cases, briefs);
  if (!rows.length) return "design: nothing to report";
  const of = (from: Row[], f: (r: Row) => boolean) => `${from.filter(f).length}/${from.length}`;
  const looks = rows.filter((r) => r.b.look), sum = (f: (i: Info) => number) => rows.reduce((s, r) => s + f(r.info), 0);
  const mean = (f: (i: Info) => number | undefined) => {
    const xs = rows.map((r) => f(r.info)).filter((x) => x !== undefined);
    return xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1) : "-";
  };
  const checked = reviewed(rows, model).filter((p) => p.agrees !== undefined);
  // A judge nobody has checked is an opinion. Its totals say so until a person has graded the same pairs.
  const trust = checked.length ? `agrees with your blind picks on ${checked.filter((p) => p.agrees).length} of ${checked.length}` : "not yet checked against a person: pnpm eval design --review";
  return [
    `design, ${rows.length} briefs built by ${model}. Judge ${judge}, ${trust}.`,
    `  craft score, of 10    with ${mean((i) => i.score)}, without ${mean((i) => i.without.score)} (the goal is 9.9)`,
    `  judge prefers         with ${of(rows, (r) => r.info.better === "with")}, without ${of(rows, (r) => r.info.better === "without")}, tie ${of(rows, (r) => r.info.better === "tie")}`,
    `  reads as its look     with ${of(looks, (r) => r.info.look === r.b.look)}, without ${of(looks, (r) => r.info.without.look === r.b.look)}`,
    `  works and is as asked with ${of(rows, (r) => r.info.faults === 0)}, without ${of(rows, (r) => r.info.without.faults === 0)}`,
    `  jobs met by an offer  ${sum((i) => i.adopted)} of ${sum((i) => i.needed)} (for each library the brief calls for, the page uses one tastebase offered)`,
  ].join("\n");
}

/**
 * The judge is only worth trusting if it agrees with you. The first call writes review.md with every recorded pair,
 * unlabelled; write A, B or tie after each `pick:`, call it again, and it reports how often the judge agreed.
 */
export function review(cases: Record<string, Entry>, briefs: Brief[], model: string): string {
  const pairs = reviewed(rowsOf(cases, briefs), model), checked = pairs.filter((p) => p.agrees !== undefined), stale = pairs.filter((p) => p.stale).length;
  if (checked.length || stale) {
    const left = pairs.length - checked.length - stale;
    return `the judge agrees with you on ${checked.filter((p) => p.agrees).length} of ${checked.length} pairs${left ? `; ${left} still to pick` : ""}${stale ? `; ${stale} rebuilt since you picked, so not counted` : ""}. To review the current builds, move ${reviewFile(model)} away and run this again.`;
  }
  const dir = join(cache, "design", model, "review");
  mkdirSync(dir, { recursive: true });
  const body = pairs.map(({ b, info, pair }) => {
    const arms = { a: pair.a, b: pair.a === "with" ? "without" : "with" } as const;
    const dirs = { with: dirOf(model, b.id, "with", info.stamp), without: dirOf(model, b.id, "without", info.opponent) };
    for (const letter of ["a", "b"] as const) for (const size of ["desktop", "mobile"]) copyFileSync(join(dirs[arms[letter]], `${size}.png`), join(dir, `${b.id}-${letter}-${size}.png`));
    return `## ${b.id}\n\n${b.brief}\n\n| A | B |\n|---|---|\n| ![](review/${b.id}-a-desktop.png) | ![](review/${b.id}-b-desktop.png) |\n| ![](review/${b.id}-a-mobile.png) | ![](review/${b.id}-b-mobile.png) |\n\npick: \n`;
  });
  writeFileSync(orderFile(model), JSON.stringify(Object.fromEntries(pairs.map(({ b, info, pair }) => [b.id, { a: pair.a, pair: info.pair }]))));
  writeFileSync(reviewFile(model), `# Blind review\n\nWrite A, B or tie after each \`pick:\`, then run \`pnpm eval design --review\` again.\n\n${body.join("\n")}`);
  return `${pairs.length} pairs to review in ${reviewFile(model)}`;
}
