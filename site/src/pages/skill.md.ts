// /skill.md: the shipped skill, so agents can install it with curl (llms.txt says how).
import type { APIRoute } from "astro";
import skill from "../../../skills/tastebase/SKILL.md?raw";

export const prerender = true;

export const GET: APIRoute = () => new Response(skill, { headers: { "content-type": "text/markdown; charset=utf-8" } });
