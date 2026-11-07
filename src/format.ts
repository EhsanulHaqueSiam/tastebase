// Text formatting for tool answers. Kept free of server deps so the site can show exactly what agents get.
import type { Plan, Scored } from "./engine.ts";
import type { Library } from "./registry/schema.ts";

export const line = (s: Scored) =>
  `${s.lib.id}: ${s.lib.tagline} | why: ${s.why} | ${s.lib.install}${s.caution ? ` | careful: ${s.caution}` : ""}`;

export function formatPlan(p: Plan): string {
  const L = p.look;
  const out = [
    `look: ${L.name}${p.lookGuessed ? " (no look named in brief; defaulted, pass look to change)" : ""}${p.also.length ? `; also fits: ${p.also.map((a) => a.id).join(", ")}` : ""}`,
    `framework: ${p.framework}${p.frameworkGuessed ? " (assumed; pass framework if not)" : ""}`,
    `type: ${L.type}`,
    `colour: ${L.colour}`,
    `motion: ${L.motion}`,
    `avoid: ${L.avoid.join("; ")}`,
    "",
  ];
  for (const it of p.items) {
    if (!it.pick) {
      out.push(`${it.kind} -> none curated for ${p.framework}; build it with plain CSS or ask for another framework`);
      continue;
    }
    const alts = it.alternatives.map((a) => a.lib.id).join(", ");
    out.push(`${it.kind} -> ${line(it.pick)}${alts ? ` | else: ${alts}` : ""}`);
  }
  return out.join("\n");
}

export function formatLibrary(l: Library): string {
  return [
    `${l.name} (${l.id}) ${l.url}`,
    l.tagline,
    `kind: ${[l.kind, ...(l.alsoCovers ?? [])].join(", ")} | ${l.frameworks.join(", ")} | ${l.styling} | weight ${l.weight} | a11y ${l.a11y} | ${l.maturity}`,
    `install: ${l.install}`,
    `usage:\n${l.usage}`,
    `note: ${l.note}`,
    `use for: ${l.useFor.join("; ")}`,
    `avoid when: ${l.avoidWhen.join("; ")}`,
    l.pairsWith?.length ? `pairs with: ${l.pairsWith.join(", ")}` : "",
    l.alternatives?.length ? `alternatives: ${l.alternatives.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
