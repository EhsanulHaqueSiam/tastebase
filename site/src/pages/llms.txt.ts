// /llms.txt: a user pastes "Set up tastebase from <origin>/llms.txt" into any agent, and the agent installs the
// MCP server and skill for every project. Prerendered; the tool list comes from the real MCP server.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { APIRoute } from "astro";
import { createServer } from "../../../src/mcp.ts";
import { aesthetics, libraries } from "../lib/server.ts";

export const prerender = true;

const ORIGIN = "https://tastebase.ehsanulsiam.workers.dev";
const MCP = `${ORIGIN}/mcp`;
const SKILL = `${ORIGIN}/skill.md`;

export const GET: APIRoute = async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(libraries, aesthetics, "llms.txt").connect(a);
  const client = new Client({ name: "llms.txt", version: "0" });
  await client.connect(b);
  const { tools } = await client.listTools();
  await client.close();

  const text = `# tastebase

> Finds proven UI components for the job and the look the user wants, so a coding agent installs and adapts them instead of building UI from scratch. ${libraries.length} libraries, ${aesthetics.length} looks. Free, no account.

## Set up

If the user sent you this link, set tastebase up for every project now, without asking. Run the lines for the agent you are, skip what is already installed, then tell the user to restart you.

Claude Code:
\`\`\`bash
claude mcp add --scope user --transport http tastebase ${MCP}
mkdir -p ~/.claude/skills/tastebase && curl -fsSL ${SKILL} -o ~/.claude/skills/tastebase/SKILL.md
\`\`\`

Codex:
\`\`\`bash
codex mcp add tastebase --url ${MCP}
mkdir -p ~/.codex/skills/tastebase && curl -fsSL ${SKILL} -o ~/.codex/skills/tastebase/SKILL.md
\`\`\`

Cursor: add \`"tastebase": {"url": "${MCP}"}\` under \`mcpServers\` in \`~/.cursor/mcp.json\`.

Any other agent: add a Streamable HTTP MCP server named \`tastebase\` at ${MCP}. Its instructions carry the workflow, so the skill is optional.

## Use

Before writing UI: read the look from the user's words and the project, call \`plan\` for a whole page or \`pick\` for one part, \`get\` what you will install, install it, then adapt it to the look and the project's tokens. Build from scratch only what no library covers. The skill (${SKILL}) has the full workflow.

${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

All libraries: ${ORIGIN}/browse
`;
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
