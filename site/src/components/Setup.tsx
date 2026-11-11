import { ArrowRight, Sparkles } from "lucide-react";
import { CopyButton, Magnetic, Rise } from "./fx.tsx";

/** Install section: hosted MCP first (no install), npx as the offline option, and a real plan answer. */
export default function Setup({ commands, sample }: { commands: string[]; sample: string }) {
  return (
    <section id="mcp" className="mx-auto max-w-6xl px-4 py-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr]">
        <Rise>
          <div className="flex items-center gap-2 text-[13px] text-fg2"><Sparkles size={14} className="text-amber" /> For Claude Code, Cursor, Codex</div>
          <h2 className="mt-2 text-[clamp(28px,3.6vw,44px)] leading-tight font-semibold tracking-[-0.035em]">One command. Better UI from every prompt.</h2>
          <p className="mt-3 max-w-[50ch] text-[15px] text-fg2">Four tools, short text answers. Your agent asks before it writes UI, installs what fits, and follows the look's rules.</p>
          <div className="mt-6 grid grid-cols-1 gap-2">
            {commands.map((c) => (
              <div key={c} className="flex items-center gap-2 rounded-xl bg-s1 py-1.5 pr-1.5 pl-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg/90">{c}</code>
                <CopyButton value={c} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-fg2">
            Paste it into Claude Code, Codex or Cursor. It reads <a href="/llms.txt" className="text-fg underline decoration-line underline-offset-2 hover:decoration-fg">llms.txt</a> and installs the MCP server and skill for every project.
          </p>
          <div className="mt-6">
            <Magnetic>
              <a href="/browse" className="sweep press inline-flex h-11 items-center gap-2 rounded-xl bg-fg px-5 font-medium text-black hover:shadow-[0_0_0_5px_rgb(255_255_255/0.1)]">
                Browse the shelf <ArrowRight size={16} />
              </a>
            </Magnetic>
          </div>
        </Rise>
        <Rise delay={0.1}>
          <div className="overflow-hidden rounded-2xl bg-s1 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[12.5px] text-fg2"><span className="size-2 rounded-full bg-green" /> What Claude gets back from <code className="font-mono text-fg">plan</code></div>
            <pre className="max-h-[420px] overflow-auto p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-fg/85">{sample}</pre>
          </div>
        </Rise>
      </div>
    </section>
  );
}
