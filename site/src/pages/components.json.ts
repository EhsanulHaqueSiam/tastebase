// Every /components group with its search terms, fetched by the page's island when search is first used, so the
// page's own HTML carries only the groups it shows. Prerendered: serving it costs no Worker.
import type { APIRoute } from "astro";
import { componentGroups } from "../lib/component-groups.ts";

export const prerender = true;

export const GET: APIRoute = () => Response.json(componentGroups());
