// Hosted MCP endpoint: `claude mcp add --transport http tastebase https://<host>/mcp`.
// Stateless Streamable HTTP: a fresh server per request, JSON responses, no sessions to store.
import type { APIRoute } from "astro";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "../../../src/mcp.ts";
import pkg from "../../../package.json" with { type: "json" };
import { aesthetics, getLibraries } from "../lib/server.ts";

export const ALL: APIRoute = async ({ request }) => {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await createServer(await getLibraries(), aesthetics, pkg.version).connect(transport);
  return transport.handleRequest(request);
};
