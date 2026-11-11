// Runs one headless Claude Code session in a throwaway project and returns what it did.
// The agent sees tastebase the way a user's agent does: the MCP server from this checkout, and optionally the
// skill we ship. Your own CLAUDE.md, plugins, hooks and MCP servers are left out so they cannot change the result.
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

export const root = join(import.meta.dirname, "../..");
export const skillFile = join(root, "skills/tastebase/SKILL.md");
/** Traces of failed samples, built pages and screenshots. Outside the repo so every worktree shares it. */
export const cache = process.env.TASTEBASE_EVAL_CACHE ?? join(homedir(), ".cache/tastebase-evals");

/** The text of the files that decide an eval's results. It goes into the fingerprint, so a changed grader or harness makes the recorded results stale. */
export const sources = (...paths: string[]) => paths.map((path) => readFileSync(join(root, path), "utf8"));

export type Call = { name: string; input: Record<string, unknown>; result: string; tastebase: boolean };
/** `capped` means the run hit its turn limit: graded as finished, but a check it failed may be the limit's doing. */
export type Trace = { calls: Call[]; text: string; files: Record<string, string>; usd: number; error?: string; capped?: boolean };
export type Files = Record<string, string>;

/** A temp directory holding `files`, plus the shipped skill when `skill` is set. Outside the repo, so pnpm treats it as its own project. */
export function project(files: Files, skill: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), "tb-eval-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  if (skill) cpSync(skillFile, join(dir, ".claude/skills/tastebase/SKILL.md"), { recursive: true });
  return dir;
}

const SKIP = new Set(["node_modules", ".claude", "dist", ".git", "pnpm-lock.yaml", "package-lock.json"]);
/** Small text files under `dir`, by relative path. */
export function readProject(dir: string, at = dir, out: Files = {}): Files {
  for (const name of readdirSync(at)) {
    if (SKIP.has(name)) continue;
    const path = join(at, name), s = statSync(path);
    if (s.isDirectory()) readProject(dir, path, out);
    else if (s.size < 100_000) out[relative(dir, path)] = readFileSync(path, "utf8");
  }
  return out;
}

// The agent runs commands, so it inherits only what Claude Code and pnpm need, never the other tokens in your shell.
const ENV = /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|LANG|TERM|NODE_EXTRA_CA_CERTS|NO_PROXY|HTTPS?_PROXY|(ANTHROPIC|CLAUDE|LC|XDG|PNPM)_.*)$/i;
// A run started by another agent must behave like one started from a terminal.
const SESSION_ENV = ["CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_MESSAGING_TOKEN", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_EFFORT", "CLAUDE_PID"];

// The few fields of a stream-json line that are read here.
type Block = { type: string; id?: string; name?: string; input?: Record<string, unknown>; tool_use_id?: string; content?: string | { text?: string }[] };
type Event = { type: string; subtype?: string; message?: { content?: Block[] | string }; result?: string; total_cost_usd?: number; is_error?: boolean; skills?: string[]; mcp_servers?: { name: string; status: string }[] };

type Run = { dir: string; prompt: string; model: string; tastebase: boolean; skill: boolean; turns: number; allow?: string[]; maxUsd?: number; timeoutMs?: number };

/** Lines of `claude -p --output-format stream-json`, or the single object of `--output-format json`. */
export function claude(args: string[], stdin: string, cwd: string, timeoutMs: number): Promise<string> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => ENV.test(k) && !SESSION_ENV.includes(k)));
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", ...args, "--no-session-persistence"], { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (out.trim()) resolve(out);
      else reject(new Error(`claude exited ${code}: ${err.trim().slice(0, 400) || "no output"}`));
    });
    child.stdin.end(stdin);
  });
}

/** Files the run created or changed are returned in `files`; the caller removes `dir`. */
export async function runAgent({ dir, prompt, model, tastebase, skill, turns, allow = [], maxUsd, timeoutMs = 300_000 }: Run): Promise<Trace> {
  const before = readProject(dir);
  const servers = tastebase ? { tastebase: { command: process.execPath, args: ["--experimental-strip-types", "--no-warnings", join(root, "src/cli.ts")] } } : {};
  const trace: Trace = { calls: [], text: "", files: {}, usd: 0 };
  const pending = new Map<string, Call>();
  let ended = false;
  try {
    const out = await claude(
      [
        "--model", model, "--effort", "low", "--max-turns", String(turns),
        "--setting-sources", "project", "--strict-mcp-config", "--mcp-config", JSON.stringify({ mcpServers: servers }),
        // Installs are not allowed unless the caller allows them: the attempt is in the trace, and that is what gets graded.
        // Skill is how the agent opens SKILL.md; without it the skill is listed but can never be read.
        "--tools", "Bash,Read,Glob,Grep,Edit,Write,Skill", "--allowedTools", "mcp__tastebase__*", "Skill", ...allow,
        "--permission-mode", "acceptEdits", "--permission-prompts", "none",
        ...(maxUsd ? ["--max-budget-usd", String(maxUsd)] : []),
        "--output-format", "stream-json", "--verbose",
      ],
      prompt, dir, timeoutMs,
    );
    for (const line of out.split("\n")) {
      if (!line.startsWith("{")) continue;
      const e = JSON.parse(line) as Event;
      const blocks = Array.isArray(e.message?.content) ? e.message.content : [];
      // A case must fail because of what the agent chose, never because the server or the skill was not there to choose.
      if (e.subtype === "init") {
        if (tastebase && e.mcp_servers?.find((s) => s.name === "tastebase")?.status !== "connected") trace.error = "the tastebase MCP server did not connect";
        if (skill && !e.skills?.includes("tastebase")) trace.error = "the tastebase skill was not offered to the agent";
      }
      if (e.type === "assistant")
        for (const b of blocks) {
          if (b.type !== "tool_use" || !b.name || !b.id) continue;
          const tb = b.name.startsWith("mcp__tastebase__");
          const call: Call = { name: tb ? b.name.slice(16) : b.name, input: b.input ?? {}, result: "", tastebase: tb };
          trace.calls.push(call);
          pending.set(b.id, call);
        }
      if (e.type === "user")
        for (const b of blocks) {
          const call = b.type === "tool_result" && pending.get(b.tool_use_id ?? "");
          if (call) call.result = typeof b.content === "string" ? b.content : (b.content ?? []).map((c) => c.text ?? "").join("\n");
        }
      if (e.type === "result") {
        ended = true;
        trace.text = e.result ?? "";
        trace.usd = e.total_cost_usd ?? 0;
        // Running out of turns is normal for a capped case; anything else is a broken run.
        if (e.subtype === "error_max_turns") trace.capped = true;
        else if (e.is_error) trace.error = `${e.subtype}: ${String(e.result).slice(0, 200)}`;
      }
    }
    // Killed by the timeout or cut off mid-stream: what it did so far is half a run and must not be graded.
    if (!ended) trace.error ??= "the run ended without a result (timed out or was cut off)";
  } catch (e) {
    trace.error = (e as Error).message;
  }
  for (const [path, body] of Object.entries(readProject(dir))) if (before[path] !== body) trace.files[path] = body;
  return trace;
}
