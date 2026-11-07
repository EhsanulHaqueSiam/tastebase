// Clones read-only reference sources into .repos/ (gitignored), pinned to the versions this repo uses.
// Agents read them instead of guessing APIs that are newer than their training data:
//   .repos/alchemy   Alchemy v2 (beta): AGENTS.md, .agents/skills, examples, provider sources
// Run `pnpm sync:repos` after bumping the matching dependency.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.dirname(import.meta.dirname);
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const repos = [{ dir: "alchemy", url: "https://github.com/alchemy-run/alchemy.git", ref: `v${pkg.devDependencies.alchemy}` }];

for (const r of repos) {
  const dest = path.join(root, ".repos", r.dir);
  if (existsSync(path.join(dest, ".git"))) {
    const head = spawnSync("git", ["-C", dest, "describe", "--tags", "--exact-match"], { encoding: "utf8" }).stdout.trim();
    if (head === r.ref) {
      console.log(`${r.dir}: already at ${r.ref}`);
      continue;
    }
    rmSync(dest, { recursive: true, force: true });
  }
  const res = spawnSync("git", ["-c", "advice.detachedHead=false", "clone", "--quiet", "--depth", "1", "--branch", r.ref, r.url, dest], { stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);
  console.log(`${r.dir}: ${r.ref}`);
}
