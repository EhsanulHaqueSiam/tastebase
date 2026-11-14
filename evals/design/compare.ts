// `pnpm eval design --compare <git ref>`: before and after sheets for a PR. For each brief, the page with tastebase
// that the ref's record rests on (before) next to the one this checkout's record rests on (after), desktop and phone,
// so a person can see what a change did instead of trusting the judge. Both are shot again with today's driver, so the
// sheet compares the builds, not the screenshot code. Free: no model is called.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "../../scripts/chromium.ts";
import { root } from "../shared/agent.ts";
import type { Entry } from "../shared/ledger.ts";
import { browse } from "./browser.ts";
import type { Brief } from "./briefs.ts";
import { builds, dirOf, type Info } from "./grade.ts";
import { inspect } from "./page.ts";

type Recorded = { model: string; cases: Record<string, Entry> };
const W = 560, H = 350, M = Math.round((H * 390) / 844);

/** Writes `<cache>/design/<model>/compare/<brief>.png` for every brief both records have, and returns their paths. */
export async function compare(ref: string, briefs: Brief[]): Promise<string[]> {
  const after: Recorded = JSON.parse(readFileSync(join(root, "evals/design/baseline.json"), "utf8"));
  const before: Recorded = JSON.parse(execFileSync("git", ["show", `${ref}:evals/design/baseline.json`], { cwd: root, encoding: "utf8" }));
  const out = builds(after.model, "compare");
  mkdirSync(out, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), "tb-compare-"));
  const sheets: string[] = [];
  try {
    await browse(chromium, async (shoot) => {
      for (const b of briefs) {
        const sides = [["before", before], ["after", after]] as const;
        const shots: { label: string; desktop: string; mobile: string }[] = [];
        for (const [name, rec] of sides) {
          const info = rec.cases[b.id]?.info as Info | undefined;
          const dist = info && join(dirOf(rec.model, b.id, "with", info.stamp), "dist");
          if (!info || !dist || !existsSync(dist)) continue;
          const dir = join(tmp, `${b.id}-${name}`);
          mkdirSync(dir);
          await inspect(dist, dir, { selectors: [] });
          const judged = rec.cases[b.id]!.pass ? "passes" : `fails: ${rec.cases[b.id]!.fails.map((f) => f.split(":")[0]).join("; ")}`;
          shots.push({ label: `${name}, as recorded: craft ${info.score ?? "?"}/10, judge prefers ${info.better}; ${judged}`, desktop: join(dir, "desktop.png"), mobile: join(dir, "mobile.png") });
        }
        if (shots.length < 2) continue;
        const cell = (s: (typeof shots)[number]) =>
          `<figure><figcaption>${s.label.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption><div><img src="file://${s.desktop}" width="${W}" height="${H}"><img src="file://${s.mobile}" width="${M}" height="${H}"></div></figure>`;
        const html = join(tmp, `${b.id}.html`);
        writeFileSync(html, `<!doctype html><style>body{margin:0;padding:16px;background:#000;color:#fff;font:13px/1.4 system-ui;display:flex;gap:24px}figure{margin:0}figcaption{height:36px}div{display:flex;gap:8px}img{border:1px solid #333;object-fit:cover;object-position:top}</style><body>${shots.map(cell).join("")}</body>`);
        const png = join(out, `${b.id}.png`);
        await shoot(`file://${html}`, { width: 2 * (W + M + 8) + 24 + 32, height: H + 36 + 32, reduced: false, png }, "[...document.images].every((i) => i.complete) ? 'ok' : undefined");
        sheets.push(png);
      }
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return sheets;
}
