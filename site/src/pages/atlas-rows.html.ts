// The Atlas's resources table rows, as a static HTML fragment the Resources tab fetches the first time it opens: 700+
// rows (~700 KB of HTML) no longer ride along with every visit to /atlas. Prerendered, so serving it costs no Worker.
import type { APIRoute } from "astro";
import { resourceKinds, resources } from "../../../src/registry/resources.ts";
import { withUtm } from "../lib/utm.ts";

export const prerender = true;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const order = Object.keys(resourceKinds);

export const GET: APIRoute = () => {
  const rows = [...resources]
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((r) => {
      const agent = r.mcp
        ? `<a href="${esc(r.mcp.url)}" target="_blank" rel="noreferrer">${esc(r.mcp.name)}${r.mcp.needsPaidPlan ? " (paid plan)" : ""}</a>`
        : `<span class="text-fg3">link only</span>`;
      return `<tr data-kind="${r.kind}"><td><a href="${esc(withUtm(r.url, "atlas"))}" target="_blank" rel="noopener">${esc(r.name)}</a></td><td>${esc(r.goodFor)}</td><td${r.free ? "" : ' class="text-fg3"'}>${esc(r.cost)}</td><td>${agent}</td></tr>`;
    });
  return new Response(rows.join(""), { headers: { "content-type": "text/html; charset=utf-8" } });
};
