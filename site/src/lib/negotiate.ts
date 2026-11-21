// Worker-side: whether a request should get a page's Markdown copy rather than its HTML. Plain string checks, well
// under the 10ms CPU budget.
import { markdownPath } from "./site.ts";

// Crawlers and fetchers of AI products that read pages for answers or training (user agents as published by each).
const AI = /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|CCBot|Bytespider|Amazonbot|meta-externalagent|cohere-ai|DuckAssistBot|MistralAI-User|YouBot|Google-CloudVertexBot/i;

/** The Markdown copy's path for a page request that asked for Markdown (Accept) or came from an AI crawler. */
export function markdownFor(request: Request): string | undefined {
  if (request.method !== "GET") return undefined;
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/api/") || pathname === "/mcp" || /\.\w+$/.test(pathname)) return undefined;
  const accept = request.headers.get("accept") ?? "";
  const wants = /\btext\/markdown\b/i.test(accept) && !/^\s*text\/html\b/i.test(accept);
  return wants || AI.test(request.headers.get("user-agent") ?? "") ? markdownPath(pathname.replace(/(.)\/+$/, "$1")) : undefined;
}
