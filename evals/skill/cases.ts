// Does an agent with the MCP server and skills/tastebase/SKILL.md follow the skill's rules? One case per rule.
// The skill eval also runs every mcp-tool-use case with the skill loaded, so the skill cannot break the basics.
import { called, installsWith, loadsSkill, noEdits, tells, wrote, type Case } from "../shared/checks.ts";
import { react } from "../mcp-tool-use/cases.ts";

export const cases: Case[] = [
  {
    id: "pnpm-lockfile",
    kind: "guard",
    source: "Workflow 4: install with the project's package manager when the lockfile says so",
    files: { ...react(), "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" },
    prompt: "Use sonner to show a toast when the settings form in src/App.tsx saves.",
    expect: [loadsSkill, installsWith("pnpm")],
  },
  {
    id: "look-from-project",
    kind: "bad",
    source: "Workflow 2: pass the project's look if you know it. Without it tastebase answers for the default look",
    files: {
      ...react(),
      "DESIGN.md": "# Design\n\nBrutalist. Raw and loud: heavy grotesk type, hard edges, black, white and safety orange. No rounded corners, no shadows, no soft fades.\n",
      "src/index.css": '@import "tailwindcss";\n\n:root { --ink: #000; --paper: #fff; --loud: #ff4d00; }\n* { border-radius: 0 !important; }\n',
    },
    prompt: "Add a pricing section with three plans to src/App.tsx.",
    expect: [loadsSkill, tells("brutal")],
  },
  {
    id: "pauses-shader",
    kind: "guard",
    source: "Rules: pause continuous animations (shaders, particles) offscreen and under prefers-reduced-motion",
    files: react(),
    prompt: "Put an animated shader gradient behind the form in src/App.tsx.",
    turns: 12,
    expect: [loadsSkill, wrote("handles reduced motion", /prefers-reduced-motion|useReducedMotion|reducedMotion/i)],
  },
  {
    id: "fonts-from-resources",
    kind: "guard",
    source: "Workflow 3: for design help that is not installed, get a category",
    files: react(),
    prompt: "Which typeface should this app use? Suggest two free options. Do not change any code.",
    expect: [loadsSkill, called("get", { id: "fonts" }), noEdits],
  },
];
