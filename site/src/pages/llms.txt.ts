// /llms.txt: what an agent reads to set tastebase up (MCP server and skill) and learn what it can ask.
// Prerendered; the tool list comes from the real MCP server, so it cannot drift from what agents get.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { APIRoute } from "astro";
import { createServer } from "../../../src/mcp.ts";
import { resourceKinds } from "../../../src/registry/resources.ts";
import { frameworks, kinds } from "../../../src/registry/schema.ts";
import { aesthetics, libraries } from "../lib/server.ts";

export const prerender = true;

const ORIGIN = "https://tastebase.ehsanulsiam.workers.dev";
const MCP = `${ORIGIN}/mcp`;

export const GET: APIRoute = async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(libraries, aesthetics, "llms.txt").connect(a);
  const client = new Client({ name: "llms.txt", version: "0" });
  await client.connect(b);
  const { tools } = await client.listTools();
  await client.close();
  const args = ({ inputSchema: s }: (typeof tools)[number]) =>
    Object.keys(s.properties ?? {}).map((k) => (s.required?.includes(k) ? k : `${k}?`)).join(", ");

  const text = `# tastebase

> Curated registry of ${libraries.length} UI libraries and ${aesthetics.length} looks. Its MCP server tells a coding agent which library to install for a UI job and a look, with the install command, real usage and the look's type, colour and motion rules. Free, read-only, no account.

Set up two parts once: the MCP server (the answers) and the skill (makes the agent ask before it writes UI). Run the lines for the agent you are in.

## MCP server

Hosted Streamable HTTP, stateless, no auth: ${MCP}

- Claude Code: \`claude mcp add --transport http tastebase ${MCP}\` (add \`--scope user\` for every project)
- Codex: \`codex mcp add tastebase --url ${MCP}\`
- Cursor, in \`.cursor/mcp.json\` or \`~/.cursor/mcp.json\`: \`{"mcpServers":{"tastebase":{"url":"${MCP}"}}}\`
- VS Code, in \`.vscode/mcp.json\`: \`{"servers":{"tastebase":{"type":"http","url":"${MCP}"}}}\`
- Any other MCP client: a Streamable HTTP server named \`tastebase\` at the URL above.

Restart or reload the agent, then check that the \`plan\` tool is listed.

## Skill

One file: ${ORIGIN}/skill.md. Save it where the agent loads skills:

- Claude Code: \`mkdir -p .claude/skills/tastebase && curl -fsSL ${ORIGIN}/skill.md -o .claude/skills/tastebase/SKILL.md\`
- Codex and agents that read \`.agents/skills\`: \`mkdir -p .agents/skills/tastebase && curl -fsSL ${ORIGIN}/skill.md -o .agents/skills/tastebase/SKILL.md\`

For every project, use \`~/.claude/skills/tastebase\` or \`~/.codex/skills/tastebase\` instead.

## Tools

${tools.map((t) => `- ${t.name}(${args(t)}): ${t.description}`).join("\n")}

## Values

- Kinds, for trending: ${kinds.join(", ")}
- Looks, for plan and get: ${aesthetics.map((l) => l.id).join(", ")}
- Design resource categories, for get: ${Object.keys(resourceKinds).join(", ")}
- Frameworks: ${frameworks.join(", ")}

## Browse

- [All libraries](${ORIGIN}/browse)
- [Atlas](${ORIGIN}/atlas): libraries grouped by look, free vs paid, and what each ships
- One library: ${ORIGIN}/browse/<id>, for example ${ORIGIN}/browse/vaul
`;
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
