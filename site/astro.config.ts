import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// No adapter here: Alchemy injects its Cloudflare adapter at build time (see ../alchemy.run.ts).
export default defineConfig({
  // Server output for /mcp and /api/*; every page opts into `prerender` and ships as a static asset.
  output: "server",
  // Prerendered pages as /browse/vaul.html, served at /browse/vaul with no trailing-slash redirect.
  build: { format: "file" },
  trailingSlash: "never",
  // Pages are static, so fetching one on hover is cheap and the click then opens it at once (ClientRouter swaps it in).
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
