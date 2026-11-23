// Hosted MCP endpoint: `claude mcp add --transport http tastebase https://<host>/mcp`.
// Stateless Streamable HTTP: a fresh server per request, JSON responses, no sessions to store. A signed-in user's agent
// key (Authorization: Bearer, never the URL, which lands in logs and history) brings their taste: what they hid is never offered, what they hearted leads a
// close call, and the `taste` tool saves to it. One D1 read per keyed request; without a key, answers are the same for everyone.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "../../../src/mcp.ts";
import type { TasteAction } from "../../../src/taste.ts";
import pkg from "../../../package.json" with { type: "json" };
import { saveTaste, tasteForKey } from "../lib/auth-data.ts";
import { aesthetics, getLibraries, libraries } from "../lib/server.ts";

// Build one server while the Worker starts (its own CPU limit): compiling the tool schemas costs ~2.5ms once, which
// would otherwise land on a cold isolate's first MCP request, the one closest to the 10ms limit (pnpm cpu).
createServer(libraries, aesthetics, pkg.version);

export const ALL: APIRoute = async ({ request }) => {
  // No server-initiated stream in stateless mode; the spec answers GET with 405.
  if (request.method === "GET") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const key = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const owner = key ? await tasteForKey(env.DB, key) : undefined;
  const taste = owner && { ...owner, save: (id: string, action: TasteAction, look?: string) => saveTaste(env.DB, owner.userId, id, action, look) };
  // A wrong or replaced key says so, rather than quietly answering without the user's taste.
  if (key && !owner) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unknown tastebase agent key. Make a new one in your account." } }, { status: 401 });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  // One data point per library used: its id only, nothing about the caller or the query. Writes are not subrequests.
  const onUse = (id: string) => env.USAGE?.writeDataPoint({ blobs: [id], indexes: [id] });
  await createServer(await getLibraries(), aesthetics, pkg.version, onUse, taste).connect(transport);
  return transport.handleRequest(request);
};
