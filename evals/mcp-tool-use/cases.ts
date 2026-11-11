// Does an agent with only the MCP server (no skill) use it the way INSTRUCTIONS and the tool descriptions in
// src/mcp.ts ask? Each case is a small project and one thing a user would type.
import { adopts, answered, asksFirst, atMost, avoids, called, declines, forFramework, noEdits, noNewKit, notCalled, tells, uses, wrote, type Case } from "../shared/checks.ts";

const pkg = (dependencies: Record<string, string>) =>
  JSON.stringify({ name: "acme-app", private: true, type: "module", dependencies, devDependencies: { vite: "^7.0.0", typescript: "^5.9.0", tailwindcss: "^4.1.0" } }, null, 2);

const settings = `import { useState } from "react";

export default function App() {
  const [name, setName] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/settings", { method: "POST", body: JSON.stringify({ name }) });
  }
  return (
    <form onSubmit={save} className="mx-auto max-w-sm space-y-3 p-6">
      <h1 className="text-lg font-medium">Settings</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2" />
      <button className="rounded bg-black px-3 py-2 text-white">Sumbit</button>
    </form>
  );
}
`;

/** A Vite + React + Tailwind app with a settings form and no UI library yet. */
export const react = (deps: Record<string, string> = {}) => ({ "package.json": pkg({ react: "^19.2.0", "react-dom": "^19.2.0", ...deps }), "src/App.tsx": settings });

export const mantine = {
  "package.json": pkg({ react: "^19.2.0", "react-dom": "^19.2.0", "@mantine/core": "^8.3.0", "@mantine/hooks": "^8.3.0" }),
  "src/App.tsx": `import { AppShell, Button, MantineProvider, Stack, TextInput, Title } from "@mantine/core";
import "@mantine/core/styles.css";

export default function App() {
  return (
    <MantineProvider>
      <AppShell padding="md">
        <Stack maw={360}>
          <Title order={3}>Account</Title>
          <TextInput label="Name" />
          <Button>Save</Button>
        </Stack>
      </AppShell>
    </MantineProvider>
  );
}
`,
};

const nuxt = {
  "package.json": JSON.stringify({ name: "acme-app", private: true, type: "module", scripts: { dev: "nuxt dev" }, dependencies: { nuxt: "^4.2.0", vue: "^3.5.0" } }, null, 2),
  "nuxt.config.ts": "export default defineNuxtConfig({ compatibilityDate: '2026-01-01' });\n",
  "app/app.vue": "<template>\n  <main class=\"p-6\">\n    <h1>Acme</h1>\n    <NuxtPage />\n  </main>\n</template>\n",
};

export const cases: Case[] = [
  {
    id: "page-plans-first",
    kind: "guard",
    source: "INSTRUCTIONS: before writing UI, call plan once with the whole brief; get only what you install",
    files: react(),
    prompt: "Build the landing page for Acme Mail, an email API for developers. Dev-tool look like Resend, with a shader background behind the hero. Put it in src/App.tsx.",
    turns: 12,
    expect: [called("plan"), asksFirst, tells("resend"), answered("plan", "gets the technical look", /^look: Technical/), atMost("plan", 1), atMost("get", 4), adopts("plan")],
  },
  {
    id: "one-job-picks",
    kind: "guard",
    source: "INSTRUCTIONS: pick for one specific job. A toast must end as sonner, not as a whole kit",
    files: react(),
    prompt: "Show a toast when the settings form in src/App.tsx saves.",
    expect: [called("pick"), notCalled("plan"), asksFirst, uses("sonner"), noNewKit()],
  },
  {
    id: "vue-project",
    kind: "bad",
    source: "docs/internals/picking.md: with no framework named, the engine assumes React. A Vue app must not get React libraries",
    files: nuxt,
    prompt: "Add a command palette that opens with cmd+k.",
    expect: [forFramework("vue", /vue|nuxt/i), avoids("cmdk")],
  },
  {
    id: "keeps-project-kit",
    kind: "bad",
    source: "plan knows the brief, not the project: it answers shadcn/ui for an app that is already on Mantine",
    files: mantine,
    prompt: "Add a billing page with a plan picker and an invoices table. Put it in src/Billing.tsx.",
    turns: 12,
    expect: [noNewKit("mantine"), wrote("builds the page with Mantine", /from "@mantine\/core"/)],
  },
  {
    id: "nothing-fits",
    kind: "bad",
    source: "src/engine.test.ts miss: pick has no score floor, so a job the registry does not cover still returns three libraries",
    files: react(),
    prompt: "Add a notes field with a rich text editor (bold, italic, lists) to the form in src/App.tsx.",
    expect: [declines("pick"), noNewKit()],
  },
  {
    id: "trending-when-asked",
    kind: "guard",
    source: "trending description: use when asked what is hot or new",
    files: react(),
    prompt: "Which UI libraries are getting popular this week? Just tell me, do not change anything.",
    expect: [called("trending"), noEdits],
  },
  {
    id: "control-typo",
    kind: "control",
    source: "ordinary work: fixing copy needs no library",
    files: react(),
    prompt: "The submit button in src/App.tsx says Sumbit. Fix the typo.",
    expect: [notCalled(), wrote("fixes the typo", />Submit</)],
  },
  {
    id: "control-backend",
    kind: "control",
    source: "ordinary work: a server route is not UI",
    files: {
      "package.json": JSON.stringify({ name: "acme-api", private: true, type: "module", dependencies: { hono: "^4.9.0" } }, null, 2),
      "src/server.ts": 'import { Hono } from "hono";\n\nconst app = new Hono();\napp.get("/", (c) => c.text("acme"));\n\nexport default app;\n',
    },
    prompt: "Add a GET /health route that returns { ok: true }.",
    expect: [notCalled(), wrote("adds the route", /\/health/)],
  },
];
