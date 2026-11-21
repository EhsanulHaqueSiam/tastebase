// /.well-known/agent-skills/index.json: Agent Skills discovery, pointing agents at the skill we ship (served at /skill.md).
// Astro's router skips dot folders, so this is a param route that answers only for ".well-known". It runs on the
// Worker (static assets may drop dot folders); the digest, the skill file's sha256, is computed once per isolate.
import type { APIRoute } from "astro";
import skill from "../../../../../skills/tastebase/SKILL.md?raw";

export const prerender = false;

const ORIGIN = "https://tastebase.ehsanulsiam.workers.dev";
let digest: Promise<string> | undefined;
const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");

export const GET: APIRoute = async ({ params }) => {
  if (params.wellknown !== ".well-known") return new Response("Not found", { status: 404 });
  const index = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: "tastebase",
        type: "skill-md",
        description: "Picks the right UI library for each part of a page and the look it should have, from a curated registry, with install commands and usage.",
        url: `${ORIGIN}/skill.md`,
        digest: `sha256:${await (digest ??= sha256(skill))}`,
      },
    ],
  };
  return Response.json(index, { headers: { "cache-control": "public, max-age=86400" } });
};
