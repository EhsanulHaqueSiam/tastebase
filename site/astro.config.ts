import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { shareCopies } from "./build.ts";

// No adapter here: Alchemy injects its Cloudflare adapter at build time (see ../alchemy.run.ts).
export default defineConfig({
  // Server output for /mcp and /api/*; every page opts into `prerender` and ships as a static asset.
  output: "server",
  // Prerendered pages as /browse/vaul.html, served at /browse/vaul with no trailing-slash redirect.
  build: { format: "file" },
  trailingSlash: "never",
  // Every same-site link loads its page on hover or focus, so the click lands on a page already fetched.
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  // shareCopies: each page's OG card and Markdown copy, written after prerendering (build.ts).
  integrations: [react(), shareCopies()],
  vite: { plugins: [tailwindcss()] },
});
