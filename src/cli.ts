#!/usr/bin/env node
// `npx tastebase` starts the MCP server on stdio: signed in, it relays to the hosted server with the user's key; signed
// out, it answers from the registry it ships with. `login` signs this machine in (browser, or --token), `logout` out.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { login, logout, relay, savedKey } from "./login.ts";
import { createServer } from "./mcp.ts";
import { aesthetics, libraries } from "./registry/index.ts";
import pkg from "../package.json" with { type: "json" };

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === "login") await login(args);
  else if (cmd === "logout") await logout();
  else {
    const key = await savedKey();
    if (key) await relay(key);
    else await createServer(libraries, aesthetics, pkg.version).connect(new StdioServerTransport());
  }
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
