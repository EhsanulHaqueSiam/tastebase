// Build-time: the /best roundups and /alternatives comparisons, written from registry data only (taglines, useFor,
// avoidWhen, alternatives, paid, frameworks, license), so they stay as right as the entries. Order is registry order,
// which is curated best-first within a kind. Every page is prerendered.
import { libraries } from "../../../src/registry/index.ts";
import type { Kind, Library } from "../../../src/registry/schema.ts";

export type Faq = { q: string; a: string };
export type Row = { lib: Library; pricing: string; open: string; bestFor: string; alternatives?: string };
export type Article = {
  kind: "best" | "alternatives";
  slug: string;
  path: string;
  title: string;
  description: string;
  intro: string[];
  libs: Library[];
  rows: Row[];
  faqs: Faq[];
  related: { label: string; href: string }[];
  /** "Best motion libraries" for a roundup; the library's own page for a comparison. */
  parent: { label: string; href: string };
};

const MIN = 3; // a roundup or comparison needs at least this many entries to be worth a page
const ROUNDUP_MAX = 12;
const FW: Record<string, string> = { react: "React", vue: "Vue", svelte: "Svelte", solid: "Solid", angular: "Angular", vanilla: "plain JavaScript", "react-native": "React Native" };
const OPEN = /\b(MIT|Apache|BSD|ISC|MPL|GPL|LGPL|AGPL|OFL|CC0|Unlicense|0BSD)\b/i;

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
/** How a roundup names a kind, plural and singular. */
const NOUN: Record<Kind, [string, string]> = {
  "component-kit": ["component kits", "component kit"],
  primitives: ["headless UI primitives", "primitives library"],
  motion: ["animation libraries", "animation library"],
  "text-effects": ["text effect libraries", "text effect library"],
  interaction: ["drawer, carousel and gesture libraries", "interaction library"],
  feedback: ["toast and feedback libraries", "toast library"],
  command: ["command menus", "command menu"],
  icons: ["icon libraries", "icon library"],
  background: ["background and shader libraries", "background library"],
  "3d": ["3D libraries", "3D library"],
  charts: ["chart libraries", "chart library"],
  glass: ["glass effect libraries", "glass effect library"],
  "agent-ui": ["agent UI libraries", "agent UI library"],
  scroll: ["scroll libraries", "scroll library"],
  tables: ["data table libraries", "data table library"],
  editor: ["rich text editors", "rich text editor"],
  code: ["code block libraries", "code block library"],
};
const noun = (k: Kind) => NOUN[k][0];
const pricing = (l: Library) => (l.paid ? `Free, ${l.paid.price} for more` : "Free");
const open = (l: Library) => (OPEN.test(l.license) ? `Yes (${l.license})` : `No (${l.license})`);
const others = (l: Library) => l.frameworks.filter((f) => f !== "react").map((f) => FW[f]!);

const byKind = new Map<Kind, Library[]>();
for (const l of libraries) byKind.set(l.kind, [...(byKind.get(l.kind) ?? []), l]);
const byId = new Map(libraries.map((l) => [l.id, l]));
const alternativesOf = (l: Library) => (l.alternatives ?? []).flatMap((id) => byId.get(id) ?? []);

export const altSlug = (l: Library) => `${l.id}-alternatives`;
export const hasAlternatives = (l: Library) => alternativesOf(l).length >= MIN - 1;

function rows(libs: Library[]): Row[] {
  return libs.map((lib) => ({ lib, pricing: pricing(lib), open: open(lib), bestFor: lib.useFor[0] ?? "", alternatives: hasAlternatives(lib) ? `/alternatives/${altSlug(lib)}` : undefined }));
}

function roundupFaqs(k: Kind, libs: Library[], free: boolean): Faq[] {
  const [top] = libs;
  const faqs: Faq[] = [{ q: `What is the best ${free ? "free " : ""}${NOUN[k][1]}?`, a: `${top!.name}: ${lower(top!.tagline)} Reach for it for ${top!.useFor[0]}.` }];
  const freeOnes = libs.filter((l) => !l.paid);
  if (!free && freeOnes.length && freeOnes.length < libs.length) faqs.push({ q: `Which of these are completely free?`, a: `${list(freeOnes.map((l) => l.name))}. The rest are free to start with a paid tier.` });
  const nonReact = libs.filter((l) => others(l).length);
  if (nonReact.length && nonReact.length < libs.length)
    faqs.push({ q: `Which work outside React?`, a: `${nonReact.length > 6 ? `${nonReact.slice(0, 6).map((l) => l.name).join(", ")} and ${nonReact.length - 6} more` : list(nonReact.map((l) => l.name))} also ship for ${list([...new Set(nonReact.flatMap(others))].slice(0, 4))}. The rest are React only.` });
  else if (nonReact.length) faqs.push({ q: `Do these work outside React?`, a: `Yes, every one of them ships for at least one other framework, such as ${list([...new Set(nonReact.flatMap(others))].slice(0, 4))}.` });
  const tiny = libs.filter((l) => l.weight === "tiny");
  if (tiny.length && tiny.length < libs.length) faqs.push({ q: `Which are the lightest?`, a: `${list(tiny.map((l) => l.name))} add the least to your bundle.` });
  return faqs;
}

function roundup(k: Kind, free: boolean): Article | undefined {
  const all = (byKind.get(k) ?? []).filter((l) => !free || !l.paid);
  if (all.length < MIN || (free && all.length === byKind.get(k)!.length)) return undefined; // "best free" only when some are paid
  const libs = all.slice(0, ROUNDUP_MAX);
  const slug = `best-${free ? "free-" : ""}${noun(k).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const title = `Best ${free ? "free " : ""}${noun(k)}`;
  return {
    kind: "best",
    slug,
    path: `/best/${slug}`,
    title,
    description: `${libs.length} hand-picked ${free ? "free " : ""}${noun(k)} for the web, with pricing, licence and what each is best at.`,
    intro: [
      `These are the ${noun(k)} we would reach for, in that order. Each one is in tastebase because it does one job well; the table says which job.`,
      `${libs[0]!.name} leads: ${lower(libs[0]!.tagline)} ${libs[1] ? `If it doesn't fit, ${libs[1].name} is the next pick: ${lower(libs[1].tagline)}` : ""}`.trim(),
    ],
    libs,
    rows: rows(libs),
    faqs: roundupFaqs(k, libs, free),
    related: [],
    parent: { label: "Best of", href: "/best" },
  };
}

function comparison(l: Library): Article | undefined {
  if (!hasAlternatives(l)) return undefined;
  const alts = alternativesOf(l);
  const freeAlt = alts.find((a) => !a.paid);
  const openAlts = alts.filter((a) => OPEN.test(a.license));
  const faqs: Faq[] = [
    { q: `Is ${l.name} free?`, a: l.paid ? `Its core is free; ${l.paid.what} costs ${l.paid.price}.` : `Yes, ${l.name} is free (${l.license}).` },
    { q: `What is the best alternative to ${l.name}?`, a: `${alts[0]!.name}: ${lower(alts[0]!.tagline)} It's best for ${alts[0]!.useFor[0]}.` },
    { q: `When should I not use ${l.name}?`, a: `${l.avoidWhen[0]?.replace(/^./, (c) => c.toUpperCase())}.` },
  ];
  if (freeAlt && freeAlt !== alts[0]) faqs.push({ q: `What is the best free alternative to ${l.name}?`, a: `${freeAlt.name}: ${lower(freeAlt.tagline)}` });
  if (openAlts.length) faqs.push({ q: `Which ${l.name} alternatives are open source?`, a: `${list(openAlts.map((a) => `${a.name} (${a.license})`))}.` });
  return {
    kind: "alternatives",
    slug: altSlug(l),
    path: `/alternatives/${altSlug(l)}`,
    title: `${l.name} alternatives`,
    description: `${alts.length} alternatives to ${l.name}, compared on pricing, licence and what each is best at.`,
    intro: [
      `${l.name} is ${lower(l.tagline).replace(/\.$/, "")}. It's the right pick for ${l.useFor[0]}.`,
      `Look elsewhere when you're dealing with ${lower(l.avoidWhen[0] ?? "a different job")}. These ${alts.length} ${noun(l.kind)} do the same job differently.`,
    ],
    libs: alts,
    rows: rows(alts),
    faqs,
    related: [],
    parent: { label: l.name, href: `/browse/${l.id}` },
  };
}

const kindsWithLibs = [...byKind.keys()];
export const roundups = kindsWithLibs.flatMap((k) => [roundup(k, false), roundup(k, true)].filter((a): a is Article => !!a));
export const comparisons = libraries.flatMap((l) => comparison(l) ?? []);

// Related chips: a roundup links its free/full twin and the comparisons of its top picks; a comparison links the
// comparisons of its alternatives and the roundup for its kind.
for (const a of roundups) {
  const twin = roundups.find((b) => b !== a && b.libs[0]?.kind === a.libs[0]?.kind);
  a.related = [...(twin ? [{ label: twin.title, href: twin.path }] : []), ...a.libs.slice(0, 4).filter(hasAlternatives).map((l) => ({ label: `${l.name} alternatives`, href: `/alternatives/${altSlug(l)}` }))];
}
for (const a of comparisons) {
  const kindRoundup = roundups.find((r) => r.kind === "best" && r.libs[0]?.kind === byId.get(a.slug.replace(/-alternatives$/, ""))?.kind && !r.slug.startsWith("best-free-"));
  a.related = [...a.libs.filter(hasAlternatives).slice(0, 4).map((l) => ({ label: `${l.name} alternatives`, href: `/alternatives/${altSlug(l)}` })), ...(kindRoundup ? [{ label: kindRoundup.title, href: kindRoundup.path }] : [])];
}

export const ORIGIN = "https://tastebase.ehsanulsiam.workers.dev";

/** BreadcrumbList, ItemList and FAQPage for one article, as one JSON-LD graph. */
export function articleJsonLd(a: Article) {
  const section = a.kind === "best" ? { name: "Best of", path: "/best" } : { name: "Alternatives", path: "/alternatives" };
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [["tastebase", "/"], [section.name, section.path], [a.title, a.path]].map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${ORIGIN}${path}` })) },
      { "@type": "ItemList", name: a.title, numberOfItems: a.libs.length, itemListElement: a.libs.map((l, i) => ({ "@type": "ListItem", position: i + 1, name: l.name, url: `${ORIGIN}/browse/${l.id}` })) },
      { "@type": "FAQPage", mainEntity: a.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
}

/** JSON-LD inside <script>: escape "<" so a value can never close the tag. */
export const jsonLd = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
