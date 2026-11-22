// POST /api/match {image: data URL} -> the closest look and libraries for a screenshot. A Workers AI vision model
// answers in JSON: one of our look ids and the UI parts it can see, from fixed lists so nothing free-form (and no
// "there are no charts") reaches the engine. The same plan engine agents use then picks a library for each part.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { aesthetics, getLibraries, planJson } from "../../lib/server.ts";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const MAX = 1_500_000; // the page sends a JPEG at most 1024px wide, well under this
const LOOKS = aesthetics.map((a) => a.id);
// Words the plan engine reads as jobs; the model may only name these, and only when they are on screen.
const PARTS = ["navbar", "hero", "cards", "bento grid", "charts", "data table", "chat", "buttons", "toggles", "tabs", "bottom sheet", "sidebar", "pricing", "toasts", "command menu", "code block", "icons", "3d scene", "carousel", "form", "animated text", "animated numbers", "shader background", "glass panels"] as const;
// Each look with the first words of its summary: bare ids alone made the model answer "minimal" for everything.
const CATALOG = aesthetics.map((a) => `${a.id}: ${a.summary.split(/\s+/).slice(0, 12).join(" ")}`).join("\n");
const PROMPT = `You are matching a UI screenshot to the design look it was built in.
Reply with JSON only: {"look": "<one id>", "parts": ["<part>", ...], "style": "<one sentence on its colours, type and shapes>"}.
"look" is the single most specific id below that fits the screenshot. Judge illustration, colour, shape, type and effects. Choose minimal only when nothing more specific fits.
${CATALOG}
"parts" lists only parts that are clearly visible, from: ${PARTS.join(", ")}.`;

type Answer = { look?: unknown; parts?: unknown; style?: unknown };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request, url }) => {
  // Same-origin only: each match spends the free plan's shared daily Workers AI allowance (10,000 neurons).
  if (request.headers.get("origin") !== url.origin) return json({ error: "Matching runs from tastebase's own /match page." }, 403);
  const body = (await request.json().catch(() => null)) as { image?: unknown } | null;
  const image = body?.image;
  if (typeof image !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(image)) return json({ error: "Send {image} as a PNG, JPEG or WebP data URL." }, 400);
  if (image.length > MAX) return json({ error: "That image is too large; send one under 1 MB." }, 413);
  try {
    const out = (await env.AI.run(MODEL, {
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: image } }] }],
      max_tokens: 200,
      temperature: 0, // the same screenshot should get the same look every time
    })) as { response?: unknown };
    // Scout returns the JSON either parsed or as text, sometimes inside a code fence.
    const raw = out.response;
    const a: Answer = typeof raw === "object" && raw ? raw : JSON.parse(String(raw ?? "").replace(/^[^{]*/, "").replace(/[^}]*$/, ""));
    const look = typeof a.look === "string" && LOOKS.includes(a.look) ? a.look : undefined;
    const parts = Array.isArray(a.parts) ? a.parts.filter((p): p is (typeof PARTS)[number] => PARTS.some((x) => x === p)) : [];
    const style = typeof a.style === "string" ? a.style : "";
    if (!look) return json({ error: "Could not place that screenshot in a look. Try a larger or clearer one." }, 422);
    return json({ description: style, parts, plan: planJson(await getLibraries(), `${look} ${parts.join(", ")}`, look) });
  } catch (e) {
    const message = (e as Error).message;
    // The free daily allowance is spent until 00:00 UTC; say so instead of a raw upstream error.
    if (/neuron|quota|limit|429|capacity/i.test(message)) return json({ error: "Screenshot matching has reached today's free limit. It resets at 00:00 UTC; describe the look in the search box meanwhile." }, 429);
    return json({ error: `Could not read the screenshot: ${message}` }, 502);
  }
};
