import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToMarkdown, pageMeta } from "./markdown.ts";

const page = `<html><head><meta property="og:title" content="Vaul &amp; friends · tastebase"><meta property="og:description" content="A drawer."><meta property="og:url" content="https://x.dev/browse/vaul"><meta property="og:image" content="https://x.dev/og/browse/vaul.jpg" data-shot="/shots/vaul.webp"></head>
<body><header>Site header</header><main><h1>Vaul</h1><p>An <a href="/browse/sonner">unstyled</a> drawer.<button>share</button></p><svg><path d="M0"/></svg>
<script>alert(1)</script><table><tr><th>Library</th><th>Pricing</th></tr><tr><td><a href="/browse/vaul">Vaul</a></td><td>Free | MIT</td></tr></table>
<ul><li>Use for <b>sheets</b></li><li>Skip for modals</li></ul><pre><code>npm i vaul &amp;&amp; done
&lt;Drawer.Root&gt;</code></pre><h2>Tom &amp; &lt;Jerry&gt;</h2><footer>Footer links</footer></main></body></html>`;

test("a page becomes Markdown: its h1 first, then description and source, without chrome, with absolute links", () => {
  const md = htmlToMarkdown(page, "https://x.dev");
  assert.ok(md.startsWith("# Vaul\n\n> A drawer.\n\nSource: https://x.dev/browse/vaul\n\n"), md);
  assert.match(md, /An \[unstyled\]\(https:\/\/x\.dev\/browse\/sonner\) drawer\./);
  assert.match(md, /\| Library \| Pricing \|\n\| --- \| --- \|\n\| \[Vaul\]\(https:\/\/x\.dev\/browse\/vaul\) \| Free \\\| MIT \|/);
  assert.match(md, /- Use for \*\*sheets\*\*\n- Skip for modals/);
  assert.match(md, /```\nnpm i vaul && done\n<Drawer.Root>\n```/);
  assert.match(md, /## Tom & <Jerry>/);
  for (const gone of ["share", "alert", "Footer links", "Site header", "<p", "<a"]) assert.ok(!md.includes(gone), gone);
});

test("page meta reads the OG card's title, description and screenshot", () => {
  assert.deepEqual(pageMeta(page), { title: "Vaul & friends · tastebase", description: "A drawer.", url: "https://x.dev/browse/vaul", image: "https://x.dev/og/browse/vaul.jpg", shot: "/shots/vaul.webp" });
});
