// Is every `usage` snippet the real API? Each library's package is installed in a throwaway project and the
// snippet's imports from it are typechecked: a renamed or invented export fails. No model is called.
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { libraries } from "../../src/registry/index.ts";
import { root } from "../shared/agent.ts";
import type { Graded } from "../shared/ledger.ts";

const sh = promisify(execFile);
const ERROR = /error TS(\d+): (.*)/g;
// A package that ships no types at all has nothing to check the snippet against, so that error is not the snippet's.
const UNTYPED = "7016";

/** The import statements of a snippet that name the library's own package or one of its subpaths. */
const own = (usage: string, npm: string) =>
  [...usage.matchAll(/^\s*import\s+(?:type\s+)?([^"';]+?)\s+from\s+["']([^"']+)["']/gm)]
    .filter((m) => (m[2] === npm || m[2]!.startsWith(`${npm}/`)) && !/\.(css|vue|svelte)$/.test(m[2]!))
    .map((m) => `import ${m[1]} from "${m[2]}";`);

/** One case per library whose snippet imports from its package. Copy-in libraries have no package to check. */
export const snippets = libraries.flatMap((l) => {
  const lines = l.npm ? own(l.usage, l.npm) : [];
  return l.npm && lines.length ? [{ id: l.id, npm: l.npm, lines }] : [];
});

export async function checkUsage({ npm, lines }: (typeof snippets)[number]): Promise<Graded> {
  const dir = mkdtempSync(join(tmpdir(), "tb-usage-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "acme-usage", private: true, type: "module" }));
    writeFileSync(join(dir, "usage.tsx"), lines.join("\n") + "\n");
    await sh("pnpm", ["add", "--silent", "--ignore-scripts", npm], { cwd: dir, timeout: 300_000 });
    const tsc = ["--noEmit", "--skipLibCheck", "--jsx", "preserve", "--module", "esnext", "--moduleResolution", "bundler", "--allowJs", "usage.tsx"];
    // tsc exits non-zero when it reports errors; anything else that stops it (missing, timed out) is the harness's fault.
    const out = await sh(join(root, "node_modules/.bin/tsc"), tsc, { cwd: dir, timeout: 120_000 }).then(
      (r) => r.stdout,
      (e: Error & { stdout?: string }) => {
        if (!e.stdout?.match(ERROR)) throw new Error(`tsc did not run: ${e.message.slice(0, 200)}`);
        return e.stdout;
      },
    );
    // Every other error is the snippet's: a missing export or module, or an import that does not parse.
    const fails = [...out.matchAll(ERROR)].filter((m) => m[1] !== UNTYPED).map((m) => `usage does not compile against ${npm}: ${m[2]}`);
    return { fails: [...new Set(fails)] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
