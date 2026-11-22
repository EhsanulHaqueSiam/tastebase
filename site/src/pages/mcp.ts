// Hosted MCP endpoint: `claude mcp add --transport http tastebase https://<host>/mcp`.
// Stateless Streamable HTTP: a fresh server per request, JSON responses, no sessions to store.
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "../../../src/mcp.ts";
import pkg from "../../../package.json" with { type: "json" };
import { aesthetics, getLibraries, libraries } from "../lib/server.ts";

// Build one server while the Worker starts (its own CPU limit): compiling the tool schemas costs ~2.5ms once, which
// would otherwise land on a cold isolate's first MCP request, the one closest to the 10ms limit (pnpm cpu).
createServer(libraries, aesthetics, pkg.version);

export const ALL: APIRoute = async ({ request }) => {
  // No server-initiated stream in stateless mode; the spec answers GET with 405.
  if (request.method === "GET") return new Response(null, { status: 405, headers: { allow: "POST" } });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  // One data point per library used: its id only, nothing about the caller or the query. Writes are not subrequests.
  const onUse = (id: string) => env.USAGE?.writeDataPoint({ blobs: [id], indexes: [id] });
  await createServer(await getLibraries(), aesthetics, pkg.version, onUse).connect(transport);
  return transport.handleRequest(request);
};
