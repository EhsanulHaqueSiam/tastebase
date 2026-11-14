// The graders and the ledger are plain logic, so they are tested here and run in CI. The evals themselves call models and do not.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { plan } from "../../src/engine.ts";
import { aesthetics, libraries } from "../../src/registry/index.ts";
import { briefs } from "../design/briefs.ts";
import type { Brief } from "../design/briefs.ts";
import { faults, type Build, type Look } from "../design/grade.ts";
import { cases as mcpCases } from "../mcp-tool-use/cases.ts";
import { cases as skillCases } from "../skill/cases.ts";
import type { Trace } from "./agent.ts";
import { adopts, answered, asksFirst, atMost, avoids, called, declines, forFramework, grade, installsWith, loadsSkill, noEdits, noNewKit, notCalled, offers, tells, used, uses, wrote } from "./checks.ts";
import { Gone, ledger, type Flags, type Graded } from "./ledger.ts";

const tb = (name: string, input: Record<string, unknown>, result = "") => ({ name, input, result, tastebase: true });
const bash = (command: string) => ({ name: "Bash", input: { command }, result: "", tastebase: false });
const write = { name: "Write", input: {}, result: "", tastebase: false };
const trace = (t: Partial<Trace>): Trace => ({ calls: [], text: "", files: {}, usd: 0, ...t });

// An agent that did everything right in a pnpm project, and one that skipped tastebase and reached for npm and a second kit.
const good = trace({
  calls: [{ name: "Skill", input: { skill: "tastebase" }, result: "", tastebase: false }, tb("pick", { need: "toast after save, Brutalist look", framework: "react" }, "sonner: toasts | npm i sonner\nreact-hot-toast: toasts"), bash("pnpm add sonner"), write],
  files: { "src/App.tsx": 'import { toast } from "sonner";\n@media (prefers-reduced-motion: reduce) {}' },
  text: "Installed with pnpm add sonner.",
});
const bad = trace({
  calls: [write, tb("plan", { brief: "a page" }, "look: Minimal\nmotion: none\nfeedback -> sonner: toasts"), tb("get", { id: "a" }), tb("get", { id: "b" }), bash("npm i @mantine/core cmdk")],
  files: { "src/App.tsx": 'import { Command } from "cmdk";' },
  text: "Run pnpm add sonner yourself.",
});

test("each check passes on the right trace and fails on the wrong one", () => {
  const rows = [
    loadsSkill, called("pick", { need: "TOAST" }), answered("pick", "is offered sonner", /^sonner:/), notCalled("plan"), atMost("get", 1), asksFirst, tells("brutal"),
    forFramework("react", /next\.js/), uses("sonner"), adopts("pick"), avoids("cmdk"), noNewKit(), installsWith("pnpm"), wrote("handles reduced motion", /prefers-reduced-motion/),
  ];
  assert.deepEqual(grade(good, rows), []);
  assert.deepEqual(grade(bad, rows), rows.map(([label]) => label));
  assert.deepEqual(grade(trace({}), [noEdits, notCalled(), declines("pick")]), []);
  assert.deepEqual(grade(good, [noEdits, notCalled(), declines("pick")]), ["changes no files", "does not call tastebase", "uses none of the libraries pick offered"]);
  // The kit the project is already on is allowed. A look rule named "motion" in a plan is not the library.
  assert.deepEqual(grade(bad, [noNewKit("mantine"), declines("plan")]), []);
});

test("saying a package's name is not using it", () => {
  const talk = trace({
    calls: [bash("cat package.json | grep sonner")],
    files: {
      "README.md": 'Do not install sonner.\nimport { toast } from "sonner"',
      "src/a.css": "@media (prefers-reduced-motion: reduce) {}",
      "src/b.tsx": 'import { m } from "framer-motion";\n// import { toast } from "sonner"\nconst hint = `later: toast from "sonner"`;',
    },
  });
  assert.deepEqual(grade(talk, [uses("sonner"), uses("motion")]), ["uses sonner", "uses motion"]);
  // Where installs are refused, trying one is the evidence.
  assert.deepEqual(grade(trace({ calls: [bash("npm install sonner")] }), [uses("sonner")]), []);
  assert.deepEqual(grade(talk, [avoids("sonner"), avoids("motion")]), []);
  // shadcn-vue is not shadcn, a subpath import is the package, and a hedge that falls back to npm in the answer is not pnpm.
  assert.deepEqual(grade(trace({ calls: [bash("npx shadcn-vue@latest init")] }), [avoids("shadcn-ui")]), []);
  assert.deepEqual(grade(trace({ calls: [bash("npx shadcn@latest add button")] }), [avoids("shadcn-ui")]), ["does not install or import shadcn-ui"]);
  assert.deepEqual(grade(trace({ files: { "a.tsx": 'import { motion } from "motion/react";' } }), [uses("motion")]), []);
  const tricky = 'const a = 1; /* import { toast } from "sonner" */\nconst s = `\nimport { toast } from "sonner"\n`;\nimport x from "a"; import { toast } from "sonner";';
  assert.deepEqual(grade(trace({ files: { "a.tsx": tricky } }), [uses("sonner")]), []);
  assert.deepEqual(grade(trace({ files: { "a.tsx": tricky.replace('import { toast } from "sonner";', "") } }), [uses("sonner")]), ["uses sonner"]);
  assert.deepEqual(grade(trace({ calls: [bash("[ -f pnpm-lock.yaml ] && pnpm add x || npm install x")], text: "It was denied, so run npm install x." }), [installsWith("pnpm")]), ["installs with pnpm"]);
  assert.deepEqual(grade(trace({ files: { "a.tsx": 'import "sonner/dist/styles.css";\nexport { toast } from "sonner";' } }), [uses("sonner")]), []);
});

test("an offer is the pick or an alternative, under the job it was offered for, and copied-in libraries count", () => {
  const brief = "dashboard with a toast after export and a command menu";
  const o = offers([["plan", { brief }], ["pick", { need: "rich text editor" }]]);
  const plain = offers([["plan", { brief }]]);
  // A later pick adds to the plan's offers and never replaces them.
  for (const [kind, ids] of plain) assert.ok([...ids].every((id) => o.get(kind)?.has(id)), kind);
  const alternative = [...plain.values()].map((ids) => libraries.find((l) => l.id === [...ids][1] && l.npm)).find(Boolean)!;
  const toast = trace({ calls: [tb("plan", { brief })], files: { "a.tsx": `import x from "${alternative.npm}";` } });
  assert.deepEqual(grade(toast, [adopts("plan")]), []);
  const copied = libraries.find((l) => l.id === "prompt-kit")!;
  // An add-on copied in through the shadcn CLI is used, and so is shadcn/ui under it; the CLI alone names no add-on.
  assert.deepEqual(used(trace({ calls: [bash(copied.install.replace("prompt-input", "chat-container"))] }), false), ["shadcn-ui", "prompt-kit"]);
  assert.deepEqual(used(trace({ calls: [bash("npx shadcn@latest add button")] }), false), ["shadcn-ui"]);
});

test("a framework argument is what tastebase answers for, whatever the brief says", () => {
  const asked = (framework: string) => trace({ calls: [tb("plan", { brief: "nuxt app with a command palette", framework })] });
  assert.deepEqual(grade(asked("vue"), [forFramework("vue", /nuxt/)]), []);
  assert.deepEqual(grade(asked("vanilla"), [forFramework("vue", /nuxt/)]), ["asks for vue libraries"]);
  assert.deepEqual(grade(trace({ calls: [tb("plan", { brief: "nuxt app with a command palette" })] }), [forFramework("vue", /nuxt/)]), []);
});

test("every case can be graded and no two share an id", () => {
  for (const list of [mcpCases, [...mcpCases, ...skillCases]]) {
    assert.equal(new Set(list.map((c) => c.id)).size, list.length);
    for (const c of list) grade(trace({}), c.expect); // throws when a check names a library the registry cannot find
  }
});

test("a design brief the engine cannot read is marked implied, and the rest are read as their look", () => {
  const read = (brief: string) => plan(libraries, aesthetics, brief).look;
  const unread = briefs.filter((b) => b.look && (read(b.brief).family ?? read(b.brief).id) !== b.look).map((b) => b.id);
  assert.deepEqual(unread, briefs.filter((b) => b.implied).map((b) => b.id));
});

test("a build is faulted for what the page does and for ignoring what it was offered", () => {
  // The judge's look travels with the build here, as the grade step reads it from the judge's answer.
  const judged = (brief: Brief, x: Build & { look?: Look }, planned: boolean) => faults(brief, x, x.look, planned);
  const probe = { errors: [], accents: 1, loops: 0, overflow: 0, text: "$9 $19 $49 frequently asked questions ".repeat(3), found: [] };
  const page = { desktop: probe, mobile: probe, reduced: probe };
  // A build whose source imports these libraries, the way the page would.
  const using = (...ids: string[]) => ({ commands: [], files: { "src/App.tsx": ids.map((id) => `import x from "${libraries.find((l) => l.id === id)!.npm}";`).join("\n") } });
  const plan_ = (brief: string): [string, Record<string, unknown>][] => [["plan", { brief }]];
  const minimal = briefs.find((b) => b.id === "minimal")!, corporate = briefs.find((b) => b.id === "corporate")!, apple = briefs.find((b) => b.id === "apple")!;
  const build = { agent: "", stamp: "", built: true, calls: plan_(minimal.brief), ...using("sonner"), look: "minimal" as Look, probe: { key: "", ...page } };
  assert.deepEqual(judged(minimal, build, true), []);
  assert.deepEqual(judged(minimal, { ...build, built: false }, true), ["does not build"]);
  assert.deepEqual(judged(minimal, { ...build, probe: { ...build.probe, desktop: { ...probe, overflow: 500 } } }, true), ["scrolls sideways at 1440px: 500px too wide"]);
  assert.deepEqual(judged(minimal, { ...build, calls: [] }, true), ["never asked tastebase"]);
  assert.deepEqual(judged(minimal, { ...build, calls: [] }, false), []); // the build without tastebase was never meant to
  // Broken only on the phone, still animating for someone who asked for less motion, and two foundation kits.
  const phone = { ...probe, errors: ["boom"], text: "", overflow: 120, accents: 3, loops: 2 };
  assert.deepEqual(judged(minimal, { ...build, look: "playful" as Look, ...using("mantine", "heroui"), probe: { key: "", desktop: probe, mobile: phone, reduced: { ...probe, loops: 4 } } }, true).map((f) => f.split(": ")[0]), [
    "renders a blank page", "throws on load", "scrolls sideways at 390px", "keeps looping under reduced motion", "mixes component kits", "reads as another look", "too many accent colours", "too many looping animations",
    "is missing three prices", "is missing an FAQ",
  ]);
  // An effects kit on top of the foundation kit is what they are made for, not a second kit.
  const effects = { ...build, files: { "components.json": "{}", "src/App.tsx": "" }, commands: ["npx shadcn@latest add @magicui/marquee"] };
  assert.deepEqual(judged(minimal, effects, true), []);
  // Asked for a chart: tastebase offered recharts, the page drew its own, or reached for a chart library it was not offered.
  const asked = { ...build, look: "corporate" as Look, calls: plan_(corporate.brief), probe: { key: "", ...page, desktop: { ...probe, found: [true, true] }, mobile: { ...probe, found: [true, true] } } };
  assert.deepEqual(judged(corporate, { ...asked, ...using("recharts") }, true), []);
  assert.deepEqual(judged(corporate, { ...asked, ...using() }, true), ["uses no charts library tastebase offered: recharts"]);
  assert.match(judged(corporate, { ...asked, ...using("uplot") }, true).join(), /goes around the plan: uplot for charts/);
  assert.deepEqual(judged(corporate, { ...asked, ...using(), calls: [] }, false), []);
  const chart = (desktop: boolean, mobile: boolean) => judged(corporate, { ...asked, ...using("recharts"), probe: { key: "", ...page, desktop: { ...probe, found: [true, desktop] }, mobile: { ...probe, found: [true, mobile] } } }, true);
  assert.deepEqual([chart(false, true), chart(true, false), chart(false, false)], [["is missing a chart: at 1440px"], ["is missing a chart: at 390px"], ["is missing a chart: at both widths"]]);
  // A motion or icon library is not going around the plan when the brief never asked for one.
  assert.deepEqual(judged(corporate, { ...asked, ...using("recharts", "gsap", "phosphor") }, true), []);
  const sheet = { ...build, look: "apple" as Look, calls: plan_(apple.brief), ...using("vaul"), probe: { key: "", ...page, desktop: { ...probe, text: "today streak ".repeat(9) }, mobile: { ...probe, text: "today streak ".repeat(9) } } };
  assert.deepEqual(judged(apple, { ...sheet, probe: { ...sheet.probe, reduced: { ...probe, click: "opens" as const } } }, true), []);
  assert.match(judged(apple, { ...sheet, probe: { ...sheet.probe, reduced: { ...probe, click: "dead" as const } } }, true).join(), /opens nothing: the control is dead/);
});

test("every library is recognised from its own install and usage, and only implies what it pairs with", () => {
  const wrong = libraries.flatMap((l) => {
    const got = used(trace({ calls: [bash(l.install)], files: { "src/App.tsx": l.usage } }), false);
    const extra = got.filter((id) => id !== l.id && id !== "shadcn-ui" && !l.pairsWith?.includes(id));
    return got.includes(l.id) && !extra.length ? [] : [`${l.id}: ${got.join(", ") || "nothing"}`];
  });
  assert.deepEqual(wrong, []);
  // A feature of a larger package is told apart by its own import, not the package's.
  assert.deepEqual(used(trace({ files: { "a.tsx": 'import { useState, startTransition } from "react";' } }), false), []);
  assert.deepEqual(used(trace({ files: { "a.tsx": 'import { ViewTransition } from "react";' } }), false), ["react-view-transition"]);
});

test("a check only flips when most samples agree, and a regression stays recorded until it is accepted", async (t) => {
  t.mock.method(console, "log", () => {});
  const dir = mkdtempSync(join(tmpdir(), "tb-ledger-"));
  const flags: Flags = { case: [], check: false, force: false, accept: false, jobs: 1 };
  const result = (...fails: string[]): Graded => ({ fails });
  // A fake eval: `text` is what the agent reads, `checker` what grading reads, and the model would give `script` in
  // order. Each drawn sample is kept, so it can be graded again. Returns what the ledger made of it.
  const kept = new Map<string, Graded & { call?: string }>();
  let gradeWith = (g: Graded) => g;
  const step = async (text: string, script: ((Graded & { call?: string }) | Error)[], with_: Partial<Flags> = {}, checker = "g1", samples?: number) => {
    let runs = 0;
    const r = await ledger({
      name: "t", cases: [{ id: "c" }], model: "m", replay: false, dir, samples, agent: () => text, grader: () => checker,
      run: async () => {
        const next: (Graded & { call?: string }) | Error = script[runs++] ?? result();
        if (next instanceof Error) throw next;
        const stamp = `s${kept.size}`;
        kept.set(stamp, next);
        return { stamp, calls: next.call ? [[next.call, {}]] : [], usd: 0 };
      },
      grade: async (_, __, stamp) => {
        const g = kept.get(stamp);
        if (!g) throw new Gone(`sample ${stamp} is gone`);
        return gradeWith(g);
      },
    }, { ...flags, ...with_ });
    return { runs, problems: r.problems, ...r.cases.c };
  };
  const pass = result(), a = result("a: one"), ab = result("a: two", "b");

  assert.partialDeepStrictEqual(await step("v1", [pass]), { runs: 1, problems: 0, pass: true });
  assert.partialDeepStrictEqual(await step("v1", []), { runs: 0, problems: 0 }); // unchanged text costs nothing
  assert.partialDeepStrictEqual(await step("v2", [], { check: true }), { runs: 0, problems: 1 }); // stale, and --check never calls
  assert.partialDeepStrictEqual(await step("v2", [a, pass, pass]), { runs: 3, problems: 0, pass: true }); // one odd failure
  assert.partialDeepStrictEqual(await step("v3", [new Error("no login")]), { problems: 1, pass: true }); // a broken run records nothing
  assert.partialDeepStrictEqual(await step("v3", [a, a]), { runs: 2, problems: 1, pass: false, worse: ["a"] });
  assert.partialDeepStrictEqual(await step("v3", []), { runs: 0, problems: 1, worse: ["a"] }); // no re-roll to clear it
  assert.partialDeepStrictEqual(await step("v3", [pass], { force: true }), { runs: 0, problems: 1, worse: ["a"] }); // not even forced
  assert.partialDeepStrictEqual(await step("v3", [], { check: true }), { runs: 0, problems: 1 });
  assert.partialDeepStrictEqual(await step("v3", [], { accept: true }), { runs: 0, problems: 0, pass: false });
  assert.equal((await step("v3", [])).worse, undefined);
  // A known failure that fails one more check is a regression too; a different detail on the same check is not.
  assert.partialDeepStrictEqual(await step("v4", [result("a: other detail")]), { runs: 1, problems: 0 });
  assert.partialDeepStrictEqual(await step("v5", [ab, ab]), { runs: 2, problems: 1, worse: ["b"] });
  assert.partialDeepStrictEqual(await step("v6", [pass, a]), { runs: 3, problems: 0, pass: true }); // script runs out: third sample passes
  assert.partialDeepStrictEqual(await step("v7", [a, a], { accept: true }), { runs: 2, problems: 0, pass: false });
  assert.partialDeepStrictEqual(await step("v8", [pass, a, a]), { runs: 3, problems: 0, pass: false }); // one lucky pass does not fix it
  // Each check is voted on by itself: two different odd failures are not a confirmed regression.
  assert.partialDeepStrictEqual(await step("v9", [result("a", "b"), result("a", "c"), a]), { runs: 3, problems: 0, fails: ["a: one"] });
  assert.partialDeepStrictEqual(await step("v10", [ab, ab], { accept: true }), { problems: 0, fails: ["a: two", "b"] });
  assert.partialDeepStrictEqual(await step("v11", [a, result("b"), ab]), { runs: 3, problems: 0, fails: ["a: two", "b"] }); // nor two odd passes a fix
  assert.match(readFileSync(join(dir, "baseline.json"), "utf8"), /^ {4}"c": \{.*\}$/m);

  // The record rests on every sample, so it keeps every call and every sample any of them made.
  const r12 = await step("v12", [{ fails: ["c"], call: "one" }, { fails: ["a", "c"], call: "two" }, { fails: ["b", "c"], call: "three" }]);
  assert.deepEqual(r12.calls?.map(([c]) => c).sort(), ["one", "three", "two"]);
  assert.equal(r12.samples?.length, 3);

  // Only the grading changed: the kept samples are graded again and nothing is drawn, even when the verdict moves.
  gradeWith = (g) => ({ fails: [...g.fails, "new check"] });
  assert.partialDeepStrictEqual(await step("v12", [], {}, "g2"), { runs: 0, problems: 1, worse: ["new check"] });
  assert.partialDeepStrictEqual(await step("v12", [], { accept: true }, "g2"), { runs: 0, problems: 0 });
  gradeWith = (g) => g;
  // A kept sample that is gone from the cache is drawn again instead: it differs from the record, so twice.
  kept.clear();
  assert.partialDeepStrictEqual(await step("v12", [result("c"), result("c")], {}, "g3"), { runs: 2, problems: 0, fails: ["c"] });

  // A regrade that moves the verdict has to happen again to count, like a new sample: one more is drawn.
  assert.partialDeepStrictEqual(await step("v15", [pass, pass]), { runs: 2, pass: true }); // a fix, confirmed twice
  gradeWith = (g) => ({ fails: [...g.fails, "t"] });
  assert.partialDeepStrictEqual(await step("v15", [pass], {}, "g4"), { runs: 1, problems: 1, worse: ["t"] });
  // A grading outage is an error, not a reason to pay for a new sample.
  gradeWith = () => { throw new Error("judge down"); };
  assert.partialDeepStrictEqual(await step("v15", [pass], {}, "g5"), { runs: 0, problems: 1, worse: ["t"] });
  // Another judge with the recorded builder regrades the kept samples and records nothing.
  gradeWith = (g) => g;
  const before = readFileSync(join(dir, "baseline.json"), "utf8");
  assert.partialDeepStrictEqual(await step("v15", [], { record: false }, "g6"), { runs: 0 });
  // Even when it disagrees: confirming the other judge's verdict would pay for pages that are never kept.
  gradeWith = (g) => ({ fails: [...g.fails, "other judge"] });
  assert.partialDeepStrictEqual(await step("v15", [pass], { record: false }, "g7"), { runs: 0 });
  gradeWith = (g) => g;
  assert.equal(readFileSync(join(dir, "baseline.json"), "utf8"), before);

  // A regrade of one sample that one more sample confirms stops there; it does not buy a third.
  assert.partialDeepStrictEqual(await step("v16", [pass]), { runs: 1 });
  gradeWith = (g) => ({ fails: [...g.fails, "u"] });
  assert.partialDeepStrictEqual(await step("v16", [pass, pass], { accept: true }, "g8"), { runs: 1, fails: ["u"] });
  // A paid sample whose grading broke is kept and graded on the next run, not bought again.
  let down = true;
  gradeWith = (g) => { if (down) throw new Error("judge down"); return g; };
  assert.partialDeepStrictEqual(await step("v17", [pass]), { runs: 1, problems: 1 });
  down = false;
  // The record was a known failure, so the resumed pass needs one more to agree: one paid run, not two.
  assert.partialDeepStrictEqual(await step("v17", [pass]), { runs: 1, problems: 0, pass: true });
  // A comparison leaves a pending sample for the recorded run, and one whose files are gone is dropped, not retried forever.
  down = true;
  assert.partialDeepStrictEqual(await step("v18", [pass]), { runs: 1, problems: 1 });
  down = false;
  assert.partialDeepStrictEqual(await step("v18", [], { record: false }, "g9"), { problems: 0 });
  kept.clear();
  assert.partialDeepStrictEqual(await step("v18", [pass, pass]), { problems: 0, pass: true });
  assert.partialDeepStrictEqual(await step("v18", []), { runs: 0, problems: 0 });
  gradeWith = (g) => g;

  // An eval that asks for three samples draws three even when the first matches the record, and keeps each one's info.
  const info = (n: number): Graded => ({ fails: [], info: { n } });
  assert.partialDeepStrictEqual(await step("v19", [info(1), info(2), info(3)], {}, "g1", 3), { runs: 3, pass: true, infos: [{ n: 1 }, { n: 2 }, { n: 3 }] });
  // A record on fewer is topped up when it is regraded, but a comparison buys nothing.
  assert.partialDeepStrictEqual(await step("v20", [pass]), { runs: 1 });
  assert.partialDeepStrictEqual(await step("v20", [pass], { record: false }, "g10", 3), { runs: 0 });
  assert.equal((await step("v20", [pass, pass], {}, "g10", 3)).samples?.length, 3);

  // Another model is never recorded, and what it reports is only what it ran.
  const other = await ledger({ name: "t", cases: [{ id: "c" }, { id: "d" }], model: "m", replay: false, dir, agent: () => "v13", grader: () => "g", run: async () => ({ stamp: "x", calls: [], usd: 0 }), grade: async () => result("z") }, { ...flags, model: "other", case: ["c"] });
  assert.deepEqual(Object.keys(other.cases), ["c"]);
  assert.deepEqual(other.cases.c?.fails, ["z"]);
  assert.notDeepEqual(JSON.parse(readFileSync(join(dir, "baseline.json"), "utf8")).cases.c.fails, ["z"]);
});
