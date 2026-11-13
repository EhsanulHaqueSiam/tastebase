// /llms.txt: a user pastes "Set up tastebase from <origin>/llms.txt" into any agent, and the agent installs the
// MCP server and skill for every project; "Update" is where the MCP server sends agents whose skill is stale. Prerendered; the tool list comes from the real MCP server.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { APIRoute } from "astro";
import { createServer } from "../../../src/mcp.ts";
import { aesthetics, libraries } from "../lib/server.ts";

export const prerender = true;

const ORIGIN = "https://tastebase.ehsanulsiam.workers.dev";
const MCP = `${ORIGIN}/mcp`;
const SKILL = `${ORIGIN}/skill.md`;
const REPO = "EhsanulHaqueSiam/tastebase";

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

Claude Code (a plugin: the skill plus the hosted MCP server):
\`\`\`bash
claude plugin marketplace add ${REPO} --sparse .claude-plugin skills
claude plugin install tastebase@tastebase
\`\`\`

Codex:
\`\`\`bash
codex mcp add tastebase --url ${MCP}
npx -y skills add ${REPO} --skill tastebase --agent codex --global --yes
\`\`\`

Cursor: add \`"tastebase": {"url": "${MCP}"}\` under \`mcpServers\` in \`~/.cursor/mcp.json\`.

Any other agent: add a Streamable HTTP MCP server named \`tastebase\` at ${MCP}, or run it locally over stdio with \`npx -y tastebase@latest\`. Its instructions carry the workflow, so the skill is optional; \`npx -y skills add ${REPO} --skill tastebase\` installs it for most agents.

## Update

The hosted MCP server is always current. Its instructions name the current skill version; when the tastebase skill you loaded says another, or none, update it with the line for how it was installed, then tell the user to restart you:

- Claude Code plugin: \`claude plugin marketplace update tastebase && claude plugin update tastebase@tastebase\`
- skills CLI: \`npx -y skills update tastebase --global --yes\`
- Copied with curl into ~/.claude/skills or ~/.codex/skills (older setups): delete that folder and install as above. In Claude Code also run \`claude mcp remove --scope user tastebase\`, since the plugin brings the server.

## Use

Before writing UI: read the look from the user's words and the project, call \`plan\` for a whole page or \`pick\` for one part, \`get\` what you will install, install it, then adapt it to the look and the project's tokens. Build from scratch only what no library covers. The skill (${SKILL}) has the full workflow.

${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

All libraries: ${ORIGIN}/browse
All looks, with how each differs and its picks: ${ORIGIN}/looks
`;
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
