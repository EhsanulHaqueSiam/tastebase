/// <reference types="astro/client" />
import type { WebsiteEnv } from "../../alchemy.run.ts";

declare global {
  /** This build's id (astro.config.ts). */
  const __BUILD__: string;
}

declare module "cloudflare:workers" {
  namespace Cloudflare {
    interface Env extends WebsiteEnv {}
  }
}
