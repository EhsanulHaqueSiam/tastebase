// The Atlas: libraries grouped by look, groups placed so similar looks sit together, and parts lined up across a
// category. Pure and deterministic; the site runs it at build time. Why it works this way: docs/internals/atlas.md.
import type { Aesthetic, AestheticId, Library } from "./registry/schema.ts";

/** A library's first look counts most; later ones less, never nothing. */
const weight = (i: number) => Math.max(0.3, 1 - 0.18 * i);

/** How strongly two looks go together, 0..1: how often the registry tags them on the same library. */
export function lookAffinity(libs: Library[]) {
  const co = new Map<string, number>();
  const top = new Map<AestheticId, number>();
  for (const l of libs)
    l.aesthetic.forEach((a, i) =>
      l.aesthetic.forEach((b, j) => {
        if (a === b) return;
        const v = (co.get(`${a}|${b}`) ?? 0) + weight(i) * weight(j);
        co.set(`${a}|${b}`, v);
        top.set(a, Math.max(top.get(a) ?? 0, v));
      }),
    );
  const one = (a: AestheticId, b: AestheticId) => (a === b ? 1 : (co.get(`${a}|${b}`) ?? 0) / (top.get(a) || 1));
  return (a: AestheticId, b: AestheticId) => (one(a, b) + one(b, a)) / 2;
}

/** Mostly paid: more parts behind the paywall than free. A few paid extras on a large free core do not count. */
export const paywalled = (l: Library) => (l.parts?.paid?.length ?? 0) > (l.parts?.free.length ?? 0);

export type Group = { key: string; looks: AestheticId[]; libs: Library[]; bestFree?: Library };

/** Group by main look. A crowded look (more than `max`) splits by second look so every group stays visually tight. */
export function groupByLook(libs: Library[], looks: Aesthetic[], max = 6): Group[] {
  const byKey = new Map<string, Library[]>();
  const add = (k: string, l: Library) => byKey.set(k, [...(byKey.get(k) ?? []), l]);
  const first = new Map<AestheticId, Library[]>();
  for (const l of libs) first.set(l.aesthetic[0]!, [...(first.get(l.aesthetic[0]!) ?? []), l]);
  for (const [look, members] of first)
    for (const l of members) add(members.length > max && l.aesthetic[1] ? `${look}/${l.aesthetic[1]}` : look, l);
  return [...byKey].map(([key, members]) => {
    const keyLooks = key.split("/") as AestheticId[];
    // The look's own curated picks win; otherwise registry order, which is best first.
    const picked = new Set(Object.values(looks.find((a) => a.id === keyLooks[0])?.picks ?? {}).flat());
    const free = members.filter((l) => !paywalled(l));
    return { key, looks: keyLooks, libs: members, bestFree: free.find((l) => picked.has(l.id)) ?? free[0] };
  });
}

const groupSim = (aff: ReturnType<typeof lookAffinity>) => (a: Group, b: Group) =>
  a.looks[0] === b.looks[0] ? 0.95 : (aff(a.looks[0]!, b.looks[0]!) + aff(a.looks.at(-1)!, b.looks.at(-1)!)) / 2;

/** Groups in a line where each sits next to the one it looks most like (moodboard order, narrow screens). */
export function chain(groups: Group[], aff: ReturnType<typeof lookAffinity>): Group[] {
  const sim = groupSim(aff);
  const left = [...groups];
  const start = left.findIndex((g) => g.looks[0] === "minimal");
  const out = left.splice(Math.max(0, start), 1);
  while (left.length) {
    const last = out.at(-1)!;
    let best = 0;
    for (let i = 1; i < left.length; i++) if (sim(last, left[i]!) > sim(last, left[best]!)) best = i;
    out.push(...left.splice(best, 1));
  }
  return out;
}

// Island box sizes in CSS px. site/src/pages/atlas.astro uses the same numbers, so boxes never overlap.
export const ISLAND = { chip: 150, row: 26, head: 46, padX: 10, padY: 8, gap: 16 };

export type Island = Group & { x: number; y: number; w: number; h: number; cols: number; order: number };

/**
 * Places one box per group: similar groups start close (classical MDS on group similarity), a pull toward the
 * centre packs them, and overlap is pushed apart until none is left. Same input, same layout.
 */
export function islands(groups: Group[], aff: ReturnType<typeof lookAffinity>, width = 1184): { islands: Island[]; width: number; height: number } {
  if (!groups.length) return { islands: [], width, height: 0 };
  const sim = groupSim(aff);
  const order = chain(groups, aff);
  const boxes = groups.map((g) => {
    const cols = g.libs.length <= 4 ? 1 : g.libs.length <= 10 ? 2 : 3;
    return { g, cols, w: cols * ISLAND.chip + 2 * ISLAND.padX, h: ISLAND.head + Math.ceil(g.libs.length / cols) * ISLAND.row + 2 * ISLAND.padY };
  });
  const seed = mds(groups.map((a) => groups.map((b) => 1 - sim(a, b))));
  const xs = seed.map((p) => p[0]), ys = seed.map((p) => p[1]);
  const span = (v: number[]) => Math.max(...v) - Math.min(...v) || 1;
  const pos = seed.map(([x, y]) => [width * (0.15 + 0.7 * (x - Math.min(...xs)) / span(xs)), 140 + 380 * (y - Math.min(...ys)) / span(ys)]);
  for (let it = 0; it < 3000; it++) {
    if (it < 500) for (const p of pos) { p[0]! += (width / 2 - p[0]!) * 0.015; p[1]! += (300 - p[1]!) * 0.05; }
    let moved = false;
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i]!, boxes[j]!], [p, q] = [pos[i]!, pos[j]!];
        const dx = q[0]! - p[0]!, dy = q[1]! - p[1]!;
        const ox = (a.w + b.w) / 2 + ISLAND.gap - Math.abs(dx), oy = (a.h + b.h) / 2 + ISLAND.gap - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // Push apart along the axis that needs the smaller move; ties go by index so the result is stable.
        if (oy < ox) { const m = (oy / 2) * (dy > 0 || (dy === 0 && i < j) ? 1 : -1); p[1]! -= m; q[1]! += m; }
        else { const m = (ox / 2) * (dx > 0 || (dx === 0 && i < j) ? 1 : -1); p[0]! -= m; q[0]! += m; }
      }
    if (!moved && it >= 500) break;
  }
  const left = Math.min(...boxes.map((b, i) => pos[i]![0]! - b.w / 2)), top = Math.min(...boxes.map((b, i) => pos[i]![1]! - b.h / 2));
  const right = Math.max(...boxes.map((b, i) => pos[i]![0]! + b.w / 2)), bottom = Math.max(...boxes.map((b, i) => pos[i]![1]! + b.h / 2));
  const w = Math.max(width, Math.ceil(right - left) + 24), ox = (w - (right - left)) / 2;
  return {
    width: w,
    height: Math.ceil(bottom - top) + 24,
    islands: boxes.map((b, i) => ({ ...b.g, cols: b.cols, w: b.w, h: b.h, x: Math.round(pos[i]![0]! - b.w / 2 - left + ox), y: Math.round(pos[i]![1]! - b.h / 2 - top + 12), order: order.indexOf(b.g) })),
  };
}

/** Classical MDS to 2D: points whose distances best match the matrix. Power iteration keeps it dependency-free. */
function mds(D: number[][]): [number, number][] {
  const n = D.length;
  if (n < 3) return D.map((_, i) => [i, 0]);
  const D2 = D.map((r) => r.map((d) => d * d));
  const rm = D2.map((r) => r.reduce((s, x) => s + x, 0) / n), gm = rm.reduce((s, x) => s + x, 0) / n;
  const B = D2.map((r, i) => r.map((x, j) => -0.5 * (x - rm[i]! - rm[j]! + gm)));
  const eig = () => {
    let v = B.map((_, i) => Math.sin(i * 12.9898 + 1) + 1.1), lam = 0;
    for (let it = 0; it < 300; it++) {
      const y = B.map((r) => r.reduce((s, x, j) => s + x * v[j]!, 0));
      lam = Math.hypot(...y) || 1e-9;
      v = y.map((x) => x / lam);
    }
    return [v, lam] as const;
  };
  const [e1, l1] = eig();
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B[i]![j]! -= l1 * e1[i]! * e1[j]!;
  const [e2, l2] = eig();
  return e1.map((v, i) => [v * Math.sqrt(l1), e2[i]! * Math.sqrt(Math.max(l2, 0))]);
}

// Same component, different names across kits.
const ALIAS: Record<string, string> = { modal: "dialog", dropdownmenu: "menu", sonner: "toast", inputotp: "otp", otpfield: "otp", pininput: "otp", otpinput: "otp", toaster: "toast", notification: "toast" };
const key = (name: string) => { const k = name.toLowerCase().replace(/[^a-z0-9]/g, ""); return ALIAS[k] ?? k; };
// Merged columns get the plain name, not whichever library's spelling came first ("Sonner" is a toast).
const LABEL: Record<string, string> = { dialog: "Dialog", menu: "Menu", toast: "Toast", otp: "OTP Input" };

export type Matrix = { columns: string[]; rows: { lib: Library; cells: ("free" | "paid" | undefined)[] }[] };

/** Parts shared by at least two libraries, as columns; undefined when a category has too little overlap to compare. */
export function partsMatrix(libs: Library[], maxColumns = 24): Matrix | undefined {
  const withParts = libs.filter((l) => l.parts?.free.length || l.parts?.paid?.length);
  const count = new Map<string, number>(), label = new Map<string, string>();
  for (const l of withParts)
    for (const k of new Set([...l.parts!.free, ...(l.parts!.paid ?? [])].map((n) => { label.set(key(n), label.get(key(n)) ?? n); return key(n); })))
      count.set(k, (count.get(k) ?? 0) + 1);
  const columns = [...count].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, maxColumns).map(([k]) => k);
  if (withParts.length < 2 || columns.length < 3) return undefined;
  const rows = withParts.map((lib) => {
    const free = new Set(lib.parts!.free.map(key)), paid = new Set((lib.parts!.paid ?? []).map(key));
    return { lib, cells: columns.map((c) => (free.has(c) ? ("free" as const) : paid.has(c) ? ("paid" as const) : undefined)) };
  });
  rows.sort((a, b) => b.cells.filter(Boolean).length - a.cells.filter(Boolean).length);
  return { columns: columns.map((c) => LABEL[c] ?? label.get(c)!), rows };
}
