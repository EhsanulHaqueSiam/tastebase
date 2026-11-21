import type { APIRoute } from "astro";
import { auth } from "../../../lib/auth.ts";

// /api/auth/* -> better-auth: GitHub sign-in, its callback, the session and sign-out. 404 on stages without auth keys.
export const ALL: APIRoute = ({ request }) => auth()?.handler(request) ?? new Response("Sign-in is not set up here.", { status: 404 });
