import assert from "node:assert/strict";
import { test } from "node:test";
import { markdownFor } from "./negotiate.ts";

const get = (path: string, headers: Record<string, string> = {}) => markdownFor(new Request(`https://x.dev${path}`, { headers }));

test("AI crawlers and clients asking for Markdown get the copy; browsers, assets and the API never do", () => {
  assert.equal(get("/browse/vaul", { accept: "text/markdown, text/html;q=0.8" }), "/browse/vaul.md");
  assert.equal(get("/", { "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" }), "/index.md");
  assert.equal(get("/browse/", { "user-agent": "ClaudeBot/1.0" }), "/browse.md");
  assert.equal(get("/browse/vaul", { accept: "text/html,application/xhtml+xml,*/*;q=0.8", "user-agent": "Mozilla/5.0 Chrome/131" }), undefined);
  assert.equal(get("/browse/vaul", { accept: "text/html, text/markdown;q=0.5" }), undefined); // prefers HTML
  for (const path of ["/api/search?q=x", "/mcp", "/shots/vaul.webp", "/browse/vaul.md"]) assert.equal(get(path, { "user-agent": "GPTBot" }), undefined, path);
});
