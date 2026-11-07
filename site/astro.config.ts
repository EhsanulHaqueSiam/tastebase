import { cacheCloudflare } from "@alchemy.run/frontend-frameworks/astro/cache";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// No adapter here: Alchemy injects its Cloudflare adapter at build time (see ../alchemy.run.ts).
export default defineConfig({
  output: "server",
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
  // Pages render on the Worker (so they can read live stats from KV) and are cached at the edge.
  cache: { provider: cacheCloudflare() },
});
