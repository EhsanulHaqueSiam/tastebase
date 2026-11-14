// Checks over a trace. Plain logic, tested in checks.test.ts, so a case reads as a list of expectations.
import { pick, plan } from "../../src/engine.ts";
import { aesthetics, libraries } from "../../src/registry/index.ts";
import { aestheticIds, frameworks, type Framework, type Kind, type Library } from "../../src/registry/schema.ts";
import type { Files, Trace } from "./agent.ts";

/** A label that reads as the expectation, and whether the trace meets it. */
export type Check = [label: string, ok: (t: Trace) => boolean];

export type Case = {
  id: string;
  /** `guard` protects correct behaviour, `bad` reproduces a mistake, `control` is work tastebase must stay out of. */
  kind: "guard" | "bad" | "control";
  /** The rule or incident this case comes from. */
  source: string;
  files: Files;
  prompt: string;
  turns?: number;
  expect: Check[];
};

const tb = (t: Trace, tool?: string) => t.calls.filter((c) => c.tastebase && (!tool || c.name === tool));
const edits = (t: Trace) => t.calls.findIndex((c) => c.name === "Write" || c.name === "Edit");
const shell = (t: Trace) => t.calls.filter((c) => c.name === "Bash").map((c) => String(c.input.command));
const byId = new Map(libraries.map((l) => [l.id, l]));
const lib = (id: string) => {
  const found = byId.get(id);
  if (!found?.npm) throw new Error(`"${id}" has no npm name in the registry, so a check cannot look for it`);
  return found as Library & { npm: string };
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const INSTALL = /\b(npm|pnpm|yarn|bun) (?:i|install|add)\b/;
const CODE = /\.(?:[cm]?[jt]sx?|vue|svelte|astro|css)$/;

/**
 * Source with comments, template literals and ordinary strings blanked. Only a string right after `from`,
 * `import` or CSS's `@plugin` survives, since that is a module name; so an import in a comment or a string is not seen.
 * shortcut: regex literals are read as code, which is fine for import statements; switch to a parser if that bites.
 */
export function blank(src: string): string {
  let out = "", i = 0, last = "";
  while (i < src.length) {
    const c = src[i]!, next = src[i + 1];
    if (c === "/" && next === "/") { const end = src.indexOf("\n", i); i = end < 0 ? src.length : end; continue; }
    if (c === "/" && next === "*") { const end = src.indexOf("*/", i + 2); i = end < 0 ? src.length : end + 2; out += " "; continue; }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += c !== "`" && (last === "from" || last === "import" || last === "plugin") ? src.slice(i, j + 1) : `${c}${c}`;
      i = j + 1;
      last = "string";
      continue;
    }
    const word = /^[\w$]+/.exec(src.slice(i, i + 64))?.[0];
    if (word) { out += word; last = word; i += word.length; continue; }
    if (!/\s/.test(c)) last = c;
    out += c;
    i++;
  }
  return out;
}

// An import or export declaration, a side-effect import, or CSS's `@import` / `@plugin` of a package.
const DECLARATION = /\b(?:import|export)\s+(?:type\s+)?(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\}|\*(?:\s*as\s+[\w$]+)?)?\s*from\s*["']([^"']+)["']|(?:\bimport|@plugin)\s*["']([^"']+)["']/g;
/** Every module a file imports from, with the names it binds ("default" for a default import). */
export const declarations = (src: string) =>
  [...blank(src).matchAll(DECLARATION)].map((m) => ({
    from: (m[3] ?? m[4])!,
    names: [...(m[1] ? ["default"] : []), ...(m[2]?.split(",").map((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!).filter(Boolean) ?? [])],
  }));
const sourceDeclarations = (files: Files) => Object.entries(files).flatMap(([path, body]) => (CODE.test(path) ? declarations(body) : []));
const within = (from: string, npm: string) => from === npm || from.startsWith(`${npm}/`);

/** A source file imports the package or one of its subpaths. A mention in a comment, a string or a README is not use. */
export const imports = (files: Files, npm: string) => sourceDeclarations(files).some((d) => within(d.from, npm));
/**
 * The agent tried to add the package: an install or CLI command names it as a whole word ("motion" is not
 * "framer-motion", "shadcn" is not "shadcn-vue"), or package.json now lists it. A denied attempt still counts.
 */
const installs = (t: Trace, npm: string) =>
  shell(t).some((cmd) => (INSTALL.test(cmd) || /\b(npx|dlx|bunx)\b/.test(cmd)) && new RegExp(`(?<![\\w@/.-])${escape(npm)}(?![\\w-])`).test(cmd)) ||
  !!t.files["package.json"]?.includes(`"${npm}":`);

// The import a library's own usage starts with that no other library's usage has: `ViewTransition` from react,
// `SplitText` from gsap/SplitText, the `@/components/ui/bubble` that AI Elements copies in. Finding it in the
// project is evidence of that library in particular, where the package alone would be shared or absent.
const pairs = (l: Library) => declarations(l.usage).flatMap((d) => d.names.map((name) => `${d.from} ${name}`));
const counts = new Map<string, number>();
for (const l of libraries) for (const p of new Set(pairs(l))) counts.set(p, (counts.get(p) ?? 0) + 1);
const packageOf = (from: string) => from.split("/").slice(0, from.startsWith("@") ? 2 : 1).join("/");
// Only the library's own code can sign for it: a copied-in path, its package or scope, or a package its install
// names. `useEffect` from react, unique to one usage, is still in nearly every page.
const own = (l: Library, from: string) =>
  /^(?:@\/|\.|\$|~\/)/.test(from) ||
  (!!l.npm && (within(from, l.npm) || (l.npm.startsWith("@") && from.startsWith(`${l.npm.split("/")[0]}/`)))) ||
  new RegExp(`(?<![\\w@/.-])${escape(packageOf(from))}(?![\\w-])`).test(l.install);
const signature = new Map(libraries.map((l) => [l.id, pairs(l).find((p) => counts.get(p) === 1 && own(l, p.split(" ")[0]!))]));
const signed = (files: Files, id: string) => {
  const [from, name] = signature.get(id)?.split(" ") ?? [];
  return !!from && sourceDeclarations(files).some((d) => d.from === from && d.names.includes(name!));
};
/**
 * The part of a library's install command that runs it, when that is the library's own: a registry scope, URL or
 * repo for add-ons copied in through the shadcn CLI, or the CLI itself (boardui, transitions-dev). The shadcn CLI
 * alone names no add-on, so it only counts for shadcn/ui.
 */
const command = (l: Library) => {
  const copied = /\badd\s+(@[\w-]+\/|https?:\/\/\S+\/|[\w-]+\/[\w-]+\/)/.exec(l.install)?.[1] ?? /\bclone\s+(?:--depth \d+\s+)?(\S+)/.exec(l.install)?.[1];
  const cli = /^(?:npx|pnpm dlx|bunx)\s+(@?[\w./-]+?)(?:@[\w.^-]+)?\s/.exec(l.install)?.[1];
  return copied ?? (cli && (cli !== "shadcn" || l.id === "shadcn-ui") ? new RegExp(`\\b(?:npx|dlx|bunx)\\s+${escape(cli)}(?:@|\\s)`) : undefined);
};
const ran = (t: Trace, l: Library) => {
  const c = command(l);
  return !!c && shell(t).some((cmd) => (typeof c === "string" ? cmd.includes(c) : c.test(cmd)));
};

/**
 * Ids of the registry libraries the agent used: it imports the package, imports the library's signature, or ran the
 * command that copies it in. `tried` also counts a package install it attempted, for evals where installs are
 * refused and the attempt is the evidence.
 */
export function used(t: Trace, tried: boolean): string[] {
  return libraries.flatMap((l) => {
    // A feature of a larger package shares its import with the parent, so only its own signature counts.
    const pkg = !!l.npm && !l.partOf && (imports(t.files, l.npm) || (tried && installs(t, l.npm)));
    return pkg || signed(t.files, l.id) || ran(t, l) || (l.id === "shadcn-ui" && "components.json" in t.files) ? [l.id] : [];
  });
}

/** The registry fields the checks read to tell which libraries a project used. Part of every grader fingerprint. */
export const evidence = libraries.map((l) => [l.id, l.kind, l.alsoCovers, l.npm, l.partOf, l.install, l.usage]);

/** A kit that is the app's foundation. Effects kits and add-ons sit on top of one, as the engine also treats them. */
export const foundation = (l: Library) =>
  l.kind === "component-kit" && !l.alsoCovers?.some((k) => k === "motion" || k === "background" || k === "text-effects") && (!!l.npm || l.id === "shadcn-ui");

/**
 * What tastebase offered in these calls, by the job it was offered for: a plan's pick and alternatives under the
 * plan's need, a pick's results under each kind they cover. Replayed through the engine, which is free and gives the
 * answer the agent read. Calls are merged, so a later call adds to an earlier one and never replaces it.
 */
export function offers(calls: [tool: string, args: Record<string, unknown>][]): Map<Kind, Set<string>> {
  const out = new Map<Kind, Set<string>>();
  const add = (kind: Kind, id: string) => out.set(kind, (out.get(kind) ?? new Set()).add(id));
  for (const [tool, args] of calls) {
    const framework = frameworks.find((f) => f === args.framework), look = aestheticIds.find((a) => a === args.look);
    if (tool === "plan")
      for (const item of plan(libraries, aesthetics, String(args.brief), { framework, look }).items)
        for (const s of item.pick ? [item.pick, ...item.alternatives] : []) add(item.kind, s.lib.id);
    if (tool === "pick")
      for (const s of pick(libraries, String(args.need), { framework, look: aesthetics.find((a) => a.id === look) })) for (const k of [s.lib.kind, ...(s.lib.alsoCovers ?? [])]) add(k, s.lib.id);
  }
  return out;
}
const asked = (t: Trace, tool: string) => tb(t, tool).map((c): [string, Record<string, unknown>] => [c.name, c.input]);
const taken = (t: Trace, tool: string) => {
  const offered = new Set([...offers(asked(t, tool)).values()].flatMap((ids) => [...ids]));
  return used(t, true).filter((id) => offered.has(id));
};

/** Some `tool` call whose arguments contain each given value (case-insensitive substring). */
export const called = (tool: string, args: Record<string, string> = {}): Check => [
  `calls ${tool}${Object.keys(args).length ? ` with ${JSON.stringify(args)}` : ""}`,
  (t) => tb(t, tool).some((c) => Object.entries(args).every(([k, v]) => String(c.input[k] ?? "").toLowerCase().includes(v.toLowerCase()))),
];
/** What tastebase answered, which is what the agent then builds from: a forced or lost look shows up here. */
export const answered = (tool: string, label: string, re: RegExp): Check => [label, (t) => tb(t, tool).some((c) => re.test(c.result))];
export const notCalled = (tool?: string): Check => [`does not call ${tool ?? "tastebase"}`, (t) => !tb(t, tool).length];
export const atMost = (tool: string, n: number): Check => [`calls ${tool} at most ${n} times`, (t) => tb(t, tool).length <= n];
export const asksFirst: Check = ["asks tastebase before writing code", (t) => tb(t).length > 0 && (edits(t) < 0 || t.calls.findIndex((c) => c.tastebase) < edits(t))];
export const loadsSkill: Check = ["opens the tastebase skill", (t) => t.calls.some((c) => c.name === "Skill" && String(c.input.skill).includes("tastebase"))];
export const noEdits: Check = ["changes no files", (t) => !Object.keys(t.files).length];
/** The word reaches tastebase in any argument: a look the user or the project named must not get lost on the way. */
export const tells = (word: string): Check => [`tells tastebase "${word}"`, (t) => tb(t).some((c) => JSON.stringify(c.input).toLowerCase().includes(word.toLowerCase()))];
/**
 * Every plan and pick is for this framework. A `framework` argument wins over the brief, so a plan may lean on the
 * brief's words only when it passes none; `pick` has only the argument.
 */
export const forFramework = (fw: Framework, words: RegExp): Check => [
  `asks for ${fw} libraries`,
  (t) => {
    const asks = tb(t).filter((c) => c.name === "plan" || c.name === "pick");
    return asks.length > 0 && asks.every((c) => c.input.framework === fw || (c.name === "plan" && !c.input.framework && words.test(String(c.input.brief))));
  },
];
/** The agent used the library: imported it, or tried to install it where installs are refused. */
export const uses = (id: string): Check => [`uses ${id}`, (t) => used(t, true).includes(lib(id).id)];
export const avoids = (id: string): Check => [`does not install or import ${id}`, (t) => !imports(t.files, lib(id).npm) && !installs(t, lib(id).npm)];
/** The agent builds with something tastebase offered, its pick or an alternative, instead of asking and then hand-rolling. */
export const adopts = (tool: "plan" | "pick"): Check => [`uses a library ${tool} offered`, (t) => taken(t, tool).length > 0];
/** For a job the registry does not cover: whatever came back is unrelated and must not be installed. */
export const declines = (tool: "plan" | "pick"): Check => [`uses none of the libraries ${tool} offered`, (t) => !taken(t, tool).length];
/** No component kit besides the one the project already has (`keep`), or none at all. */
export const noNewKit = (keep?: string): Check => [
  keep ? `adds no component kit next to ${keep}` : "adds no component kit",
  (t) => !used(t, true).some((id) => id !== keep && foundation(byId.get(id)!)),
];
/** The first install the agent ran or tried, and every install it told the user to run, use this package manager. */
export const installsWith = (pm: "npm" | "pnpm" | "yarn" | "bun"): Check => [
  `installs with ${pm}`,
  (t) => {
    const ran = INSTALL.exec(shell(t).join("\n"))?.[1];
    const said = [...t.text.matchAll(new RegExp(INSTALL, "g"))].map((m) => m[1]);
    return (ran ?? said[0]) === pm && said.every((s) => s === pm);
  },
];
export const wrote = (label: string, re: RegExp): Check => [label, (t) => Object.values(t.files).some((f) => re.test(f))];

/** Labels of the checks a trace fails. */
export const grade = (t: Trace, expect: Check[]) => expect.filter(([, ok]) => !ok(t)).map(([label]) => label);
