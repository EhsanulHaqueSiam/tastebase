// Does tastebase make the page better? Each brief is built twice by the same model in the same starter project,
// once with tastebase (MCP server and skill) and once without. This file makes the builds: the paid step. Grading
// them is grade.ts, which works on kept builds, so a change there never builds a page again.
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { project, runAgent, skillFile, sources, type Files } from "../shared/agent.ts";
import { hash, type Sample, type TbCall } from "../shared/ledger.ts";
import type { Brief } from "./briefs.ts";
import { builds, dirOf, load, type Arm, type Build } from "./grade.ts";

const sh = promisify(execFile);

// A bare Vite + React + Tailwind app, as `pnpm create vite` plus the Tailwind plugin leaves it. The build
// typechecks, as that template's does, so a prop or export a library does not have fails the build.
const TEMPLATE: Files = {
  "package.json": JSON.stringify(
    {
      name: "acme-page", private: true, type: "module",
      scripts: { dev: "vite", build: "tsc --noEmit && vite build" },
      dependencies: { react: "^19.3.1", "react-dom": "^19.3.1" },
      devDependencies: { "@tailwindcss/vite": "^4.3.5", "@types/react": "^19.3.0", "@types/react-dom": "^19.3.0", "@vitejs/plugin-react": "^6.3.0", tailwindcss: "^4.3.5", typescript: "^7.0.2", vite: "^8.3.8" },
    },
    null, 2,
  ),
  "vite.config.ts": 'import tailwindcss from "@tailwindcss/vite";\nimport react from "@vitejs/plugin-react";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [react(), tailwindcss()], resolve: { alias: { "@": "/src" } } });\n',
  "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2023", lib: ["ES2023", "DOM", "DOM.Iterable"], module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", strict: true, skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true, types: ["vite/client"], paths: { "@/*": ["./src/*"] } }, include: ["src"] }, null, 2),
  "index.html": '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Acme</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n',
  "src/main.tsx": 'import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App.tsx";\nimport "./index.css";\n\ncreateRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);\n',
  "src/index.css": '@import "tailwindcss";\n',
  "src/App.tsx": "export default function App() {\n  return <main />;\n}\n",
};

// The only commands a build agent may run that change anything. This narrows what it can do; it is not a sandbox:
// the agent writes code and `pnpm build` runs it, so run this eval only against registry text you have read.
const ALLOW = ["Bash(pnpm add *)", "Bash(pnpm install)", "Bash(pnpm build)", "Bash(pnpm run build)", "Bash(pnpm dlx shadcn@latest *)", "Bash(npx shadcn@latest *)"];

// How the build agent runs. Part of what a build depends on, so changing it builds the pages again.
const RUN = { turns: 60, allow: ALLOW, maxUsd: 3, timeoutMs: 1_200_000 };

const prompt = (brief: string) =>
  `Build this in the Vite + React + Tailwind project in the current directory:\n\n${brief}\n\nOne page, starting at src/App.tsx. Dependencies are installed; add what you need with pnpm. You are done when \`pnpm build\` passes. Do not start a dev server.`;

/**
 * What a build depends on besides tastebase's answers and the model, which the ledger adds. The build without
 * tastebase never reads the skill or the tools, so tastebase's text cannot change it: it is the fixed opponent.
 */
export const agentInputs = (b: Brief, arm: Arm) => [sources("evals/shared/agent.ts"), TEMPLATE, RUN, prompt(b.brief), arm === "with" && readFileSync(skillFile, "utf8")];

// The files that show which libraries a build used. Everything else the agent wrote is the page itself, kept in dist.
const EVIDENCE = /\.(?:[cm]?[jt]sx?|css)$|(?:^|\/)(?:package|components)\.json$/;

/** Builds one arm of a brief and keeps it, page and all, under a new stamp. */
async function build(b: Brief, arm: Arm, model: string): Promise<Build & { usd: number }> {
  const stamp = randomUUID(), out = dirOf(model, b.id, arm, stamp);
  mkdirSync(out, { recursive: true });
  const dir = project(TEMPLATE, arm === "with");
  try {
    await sh("pnpm", ["install", "--silent"], { cwd: dir, timeout: 300_000 });
    const t = await runAgent({ dir, prompt: prompt(b.brief), model, tastebase: arm === "with", skill: arm === "with", ...RUN });
    if (t.error) throw new Error(t.error);
    const built = await sh("pnpm", ["build"], { cwd: dir, timeout: 300_000 }).then(() => existsSync(join(dir, "dist/index.html")), () => false);
    if (built) cpSync(join(dir, "dist"), join(out, "dist"), { recursive: true });
    const result: Build = {
      stamp, agent: hash(agentInputs(b, arm)), built,
      calls: t.calls.filter((c) => c.tastebase).map((c): TbCall => [c.name, c.input]),
      files: Object.fromEntries(Object.entries(t.files).filter(([path]) => EVIDENCE.test(path))),
      commands: t.calls.filter((c) => c.name === "Bash").map((c) => String(c.input.command)),
    };
    writeFileSync(join(out, "build.json"), JSON.stringify(result, null, 2));
    return { ...result, usd: t.usd };
  } catch (e) {
    rmSync(out, { recursive: true, force: true });
    throw e;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The `n`th newest kept build without tastebase made from the same inputs, or a new one, so each sample of a brief
 * meets a different page. `fresh` always makes a new one. A kept build that failed, or lost its page, is skipped: a
 * broken opponent would count every page with tastebase as better, or could never be graded.
 */
async function opponent(b: Brief, model: string, n: number, fresh: boolean): Promise<Build & { usd: number }> {
  const root = join(builds(model, b.id), "without"), agent = hash(agentInputs(b, "without"));
  const kept = fresh || !existsSync(root) ? [] : readdirSync(root).map((s) => ({ dir: join(root, s), at: statSync(join(root, s)).mtimeMs })).sort((x, y) => y.at - x.at);
  const usable = kept.flatMap(({ dir }) => {
    const x = load(dir);
    return x?.agent === agent && x.built && existsSync(join(dir, "dist", "index.html")) ? [x] : [];
  });
  return usable[n] ? { ...usable[n], usd: 0 } : build(b, "without", model);
}

/**
 * One paid sample of a brief: a new build with tastebase, next to the `n`th kept build without it (or a new one when
 * there is none, the inputs changed, or `force` asks for it).
 */
export async function sample(b: Brief, model: string, n: number, force: boolean): Promise<Sample> {
  const [plain, mine] = await Promise.all([opponent(b, model, n, force), build(b, "with", model)]);
  const { usd, ...kept } = mine;
  writeFileSync(join(dirOf(model, b.id, "with", mine.stamp), "build.json"), JSON.stringify({ ...kept, opponent: plain.stamp }, null, 2));
  return { stamp: mine.stamp, calls: mine.calls, usd: usd + plain.usd };
}
