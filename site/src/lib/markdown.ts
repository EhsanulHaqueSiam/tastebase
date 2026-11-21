// Build-time: a built page as Markdown, for AI crawlers and agents that send Accept: text/markdown (site/build.ts writes
// one next to every prerendered page; worker.ts serves it). Regex over our own HTML, which is regular enough: the
// page's <main>, without the footer, scripts, buttons and icons. Not a general HTML parser.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", middot: "·" };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m)));
// Entities stay encoded until the end, so a decoded "<" is never mistaken for a tag; code is stashed for the same reason.
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`, "i"))?.[1];

/** The `<meta>` a page's card and copy are made from. */
export function pageMeta(html: string) {
  const meta = (key: string) => {
    const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]*>`, "i"))?.[0];
    return tag && decode(attr(tag, "content") ?? "");
  };
  const image = html.match(/<meta[^>]+property="og:image"[^>]*>/i)?.[0] ?? "";
  return { title: meta("og:title") ?? "", description: meta("og:description") ?? "", url: meta("og:url") ?? "", image: attr(image, "content") ?? "", shot: attr(image, "data-shot") };
}

/** `html` (a whole built page) as Markdown, with relative links made absolute against `origin`. */
export function htmlToMarkdown(html: string, origin: string): string {
  const { title, description, url } = pageMeta(html);
  let s = html.match(/<main[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? html;
  for (const tag of ["script", "style", "template", "noscript", "svg", "footer", "nav", "button", "header"]) s = s.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
  const abs = (href: string) => (href.startsWith("/") ? origin + href : href);
  const code: string[] = [];
  const stash = (c: string) => `\u0000${code.push(decode(c.replace(/<[^>]+>/g, ""))) - 1}\u0000`;
  // Inline marks first, so tables, headings and list items keep them when they flatten their cells to text.
  s = s
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c: string) => `\n\n\`\`\`\n${stash(c)}\n\`\`\`\n\n`)
    .replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, a: string, inner: string) => {
      const t = text(inner);
      const href = attr(` ${a}`, "href");
      return t && href ? `[${t}](${abs(href)})` : t;
    })
    .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_, inner: string) => `**${text(inner)}**`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, inner: string) => `\`${stash(inner)}\``)
    .replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, inner: string) => {
      const rows = [...inner.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1]!.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1]!).replace(/\|/g, "\\|") || " "));
      if (!rows.length) return "";
      const w = Math.max(...rows.map((r) => r.length));
      const line = (r: string[]) => `| ${[...r, ...Array(w - r.length).fill(" ")].join(" | ")} |`;
      return `\n\n${[line(rows[0]!), line(Array(w).fill("---")), ...rows.slice(1).map(line)].join("\n")}\n\n`;
    })
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n: string, inner: string) => `\n\n${"#".repeat(Number(n))} ${text(inner)}\n\n`)
    .replace(/<(?:summary|dt)[^>]*>([\s\S]*?)<\/(?:summary|dt)>/gi, (_, inner: string) => `\n\n**${text(inner)}**\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner: string) => `\n- ${text(inner)}`)
    .replace(/<\/(?:p|div|section|article|ul|ol|dl|dd|details|blockquote)>|<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  const body = decode(s)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => code[Number(i)]!);
  // The page's own h1 leads, then the description and where the HTML lives, then the rest.
  const [h1, ...rest] = body.startsWith("# ") ? body.split("\n\n") : [`# ${title}`, body];
  return `${[h1, description && `> ${description}`, url && `Source: ${url}`, ...rest].filter(Boolean).join("\n\n")}\n`;
}
