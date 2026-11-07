#!/usr/bin/env node
// `npx tastebase` starts the MCP server on stdio. That is the whole CLI: agents talk to it through MCP.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp.ts";
import { aesthetics, libraries } from "./registry/index.ts";
import pkg from "../package.json" with { type: "json" };

await createServer(libraries, aesthetics, pkg.version).connect(new StdioServerTransport());
