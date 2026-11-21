// MCP servers that let an agent work with a UI library or design tool. tastebase links to them and writes their
// setup for each client; it never runs them or holds anyone's key. Every package was checked on npm and every
// command against the provider's own setup page on 2026-11-21. The first eight follow Col's verified list (MIT).

export type Integration = {
  id: string;
  name: string;
  provider: string;
  /** The provider also makes the product it serves. */
  official: boolean;
  /** Library id it serves, when tastebase lists that library. */
  lib?: string;
  /** The provider's setup page. */
  docs: string;
  goodFor: string;
  /** What to know before setup, from the provider's docs. */
  note?: string;
  /** A local command the client starts, or a remote Streamable HTTP endpoint. */
  server: { cmd: string } | { url: string; auth?: "oauth" | { header: string; env: string } };
};

export const integrations: Integration[] = [
  {
    id: "shadcn",
    name: "shadcn MCP",
    provider: "shadcn/ui",
    official: true,
    lib: "shadcn-ui",
    docs: "https://ui.shadcn.com/docs/mcp",
    goodFor: "Browse, search and install items from shadcn/ui and every registry in components.json (Magic UI, Aceternity and others).",
    note: "Run it in a project with components.json.",
    server: { cmd: "npx shadcn@latest mcp" },
  },
  {
    id: "figma",
    name: "Figma MCP",
    provider: "Figma",
    official: true,
    docs: "https://developers.figma.com/docs/figma-mcp-server/",
    goodFor: "Design context from Figma files: selected frames to code, variables and components.",
    note: "Sign in with Figma on first connect.",
    server: { url: "https://mcp.figma.com/mcp", auth: "oauth" },
  },
  {
    id: "mui",
    name: "MUI MCP",
    provider: "MUI",
    official: true,
    lib: "mui",
    docs: "https://mui.com/material-ui/getting-started/mcp/",
    goodFor: "Material UI answers from the official docs, with links to the pages it quotes.",
    server: { cmd: "npx -y @mui/mcp@latest" },
  },
  {
    id: "21st",
    name: "21st MCP",
    provider: "21st.dev",
    official: true,
    docs: "https://21st.dev/mcp",
    goodFor: "Search the 21st.dev catalog of community React components and fetch their code.",
    note: "Search is free; component code and generation are paid. Key from 21st.dev/mcp.",
    server: { url: "https://21st.dev/api/mcp", auth: { header: "x-api-key", env: "API_KEY_21ST" } },
  },
  {
    id: "boardui",
    name: "BoardUI MCP",
    provider: "BoardUI",
    official: true,
    lib: "boardui",
    docs: "https://www.boardui.com/mcp",
    goodFor: "Browse BoardUI components and examples, install source and set up a project.",
    note: "Pro source needs a BoardUI Pro license.",
    server: { cmd: "npx -y boardui@latest mcp" },
  },
  {
    id: "affect-ui",
    name: "affectUI MCP",
    provider: "affectUI",
    official: true,
    lib: "affect-ui",
    docs: "https://www.affectui.com/docs/ai",
    goodFor: "Search affectUI items and read their docs, props and install commands.",
    note: "Pro source needs the AFFECTUI_TOKEN key.",
    server: { url: "https://www.affectui.com/api/mcp" },
  },
  {
    id: "aicanvas",
    name: "AI Canvas MCP",
    provider: "AI Canvas",
    official: true,
    docs: "https://aicanvas.me/mcp",
    goodFor: "Search, inspect and install AI Canvas components with their design spec and motion.",
    note: "Installs need AICANVAS_TOKEN from a free account.",
    server: { cmd: "npx -y @aicanvas/mcp" },
  },
  {
    id: "shadcn-ui-mcp-server",
    name: "shadcn/ui v4 MCP server",
    provider: "Jpisnice",
    official: false,
    lib: "shadcn-ui",
    docs: "https://github.com/Jpisnice/shadcn-ui-mcp-server",
    goodFor: "shadcn/ui v4 source, demos and blocks for React, Svelte, Vue or React Native.",
    note: "60 GitHub requests an hour without GITHUB_PERSONAL_ACCESS_TOKEN.",
    server: { cmd: "npx @jpisnice/shadcn-ui-mcp-server" },
  },
  {
    id: "heroui-react",
    name: "HeroUI MCP",
    provider: "HeroUI",
    official: true,
    lib: "heroui",
    docs: "https://heroui.com/docs/react/getting-started/mcp-server",
    goodFor: "HeroUI v3 component docs, props and examples.",
    note: "HeroUI v3 only; Node 22+.",
    server: { cmd: "npx -y @heroui/react-mcp@latest" },
  },
  {
    id: "mantine",
    name: "Mantine MCP",
    provider: "Mantine",
    official: true,
    lib: "mantine",
    docs: "https://mantine.dev/guides/llms/",
    goodFor: "Search and read Mantine documentation.",
    server: { cmd: "npx -y @mantine/mcp-server" },
  },
  {
    id: "chakra-ui",
    name: "Chakra UI MCP",
    provider: "Chakra UI",
    official: true,
    docs: "https://chakra-ui.com/docs/get-started/ai/mcp-server",
    goodFor: "Chakra UI v3 components, props, themes and migration help.",
    note: "Pro templates need CHAKRA_PRO_API_KEY.",
    server: { cmd: "npx -y @chakra-ui/react-mcp" },
  },
];

export const mcpClients = ["Claude Code", "Codex", "Cursor", "VS Code"] as const;
export type McpClient = (typeof mcpClients)[number];

/** Setup for one client, in that client's own syntax; secrets are referenced by env var or prompt, never written. */
export function mcpSetup(i: Integration, client: McpClient): string {
  const s = i.server;
  const [command, ...args] = "cmd" in s ? s.cmd.split(" ") : [];
  const key = "url" in s && typeof s.auth === "object" ? s.auth : undefined;
  const json = (v: unknown) => JSON.stringify(v, null, 2);
  switch (client) {
    case "Claude Code":
      return "cmd" in s ? `claude mcp add ${i.id} -- ${s.cmd}` : `claude mcp add --transport http ${i.id} ${s.url}${key ? ` --header "${key.header}: $${key.env}"` : ""}`;
    case "Codex":
      if ("cmd" in s) return `codex mcp add ${i.id} -- ${s.cmd}`;
      return key ? `# ~/.codex/config.toml\n[mcp_servers.${i.id}]\nurl = "${s.url}"\nenv_http_headers = { "${key.header}" = "${key.env}" }` : `codex mcp add ${i.id} --url ${s.url}`;
    case "Cursor":
      return `// .cursor/mcp.json\n${json({ mcpServers: { [i.id]: "cmd" in s ? { command, args } : { url: s.url, ...(key && { headers: { [key.header]: `\${env:${key.env}}` } }) } } })}`;
    case "VS Code": {
      const input = key?.env.toLowerCase().replaceAll("_", "-");
      const server = "cmd" in s ? { type: "stdio", command, args } : { type: "http", url: s.url, ...(key && { headers: { [key.header]: `\${input:${input}}` } }) };
      return `// .vscode/mcp.json\n${json({ ...(key && { inputs: [{ type: "promptString", id: input, description: key.env, password: true }] }), servers: { [i.id]: server } })}`;
    }
  }
}
