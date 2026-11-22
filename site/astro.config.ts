import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { shareCopies } from "./build.ts";

// No adapter here: Alchemy injects its Cloudflare adapter at build time (see ../alchemy.run.ts).
export default defineConfig({
  // Scoped styles mark elements with a short class instead of a data-astro-cid-* attribute (same specificity): on
  // /atlas the attributes alone were ~750 KB of the HTML.
  scopedStyleStrategy: "class",
  // Server output for /mcp and /api/*; every page opts into `prerender` and ships as a static asset.
  output: "server",
  // Prerendered pages as /browse/vaul.html, served at /browse/vaul with no trailing-slash redirect.
  // Styles inline in each page: on a phone network a stylesheet is one more ~560ms round trip before first paint,
  // which costs more than re-sending ~20 KB of compressed CSS with each page.
  build: { format: "file", inlineStylesheets: "always" },
  trailingSlash: "never",
  // Every same-site link loads its page on hover or focus, so the click lands on a page already fetched.
  prefetch: false, // src/lib/prefetch.ts: Astro's <link rel="prefetch"> was never reused by the router (see there)
  // shareCopies: each page's OG card and Markdown copy, written after prerendering (build.ts).
  integrations: [react(), shareCopies()],
  // __BUILD__: one id per build, stamped on every page, so an open tab can tell it is a deploy behind (lib/prefetch.ts).
  vite: { plugins: [tailwindcss()], define: { __BUILD__: JSON.stringify(Date.now().toString(36)) } },
  // Off: under pnpm dev its pill covers the phone tab bar, and its overlays (Audit, X-ray) widen the page, so local
  // screenshots, pnpm flows and pnpm bombadil would judge the toolbar instead of the site.
  devToolbar: { enabled: false },
});
