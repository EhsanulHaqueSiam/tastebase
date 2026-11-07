// Prepares a fresh checkout or T3 worktree: links the main checkout's .env (secrets never get copied
// into git) and installs dependencies. t3.json runs it on worktree creation, in the background, so it
// leaves markers agents can wait on: .t3/setup-running (holds the PID), then .t3/setup-done or
// .t3/setup-failed (with the error tail). Uses only Node built-ins because it runs before install.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.dirname(import.meta.dirname);
const marks = path.join(root, ".t3");
mkdirSync(marks, { recursive: true });
rmSync(path.join(marks, "setup-done"), { force: true });
rmSync(path.join(marks, "setup-failed"), { force: true });
writeFileSync(path.join(marks, "setup-running"), `${process.pid}\n`);

let tail = "";
process.on("exit", (code) => {
  rmSync(path.join(marks, "setup-running"), { force: true });
  if (code === 0) writeFileSync(path.join(marks, "setup-done"), "");
  else writeFileSync(path.join(marks, "setup-failed"), `setup exited with ${code}\n${tail}\n`);
});

// The main checkout owns the shared .git dir; T3CODE_PROJECT_ROOT is not always set.
const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root, encoding: "utf8" }).stdout?.trim();
const main = process.env.T3CODE_PROJECT_ROOT ?? (common ? path.dirname(common) : undefined);
const env = path.join(root, ".env");
if (main && path.resolve(main) !== root && existsSync(path.join(main, ".env")) && !existsSync(env)) {
  symlinkSync(path.join(main, ".env"), env);
  console.log("linked .env from", main);
}

// A stale lockfile must fail, not be rewritten.
const install = spawnSync("pnpm", ["install", "--frozen-lockfile"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
process.stdout.write(install.stdout ?? "");
process.stderr.write(install.stderr ?? "");
tail = `${install.stdout ?? ""}${install.stderr ?? ""}`.split("\n").slice(-30).join("\n");
process.exit(install.status ?? 1);
