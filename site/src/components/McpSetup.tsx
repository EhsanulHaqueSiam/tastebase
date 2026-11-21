// One MCP server's setup with a tab per client; the code is generated from the registry entry (mcpSetup).
import { useState } from "react";
import { mcpClients, mcpSetup, type Integration, type McpClient } from "../../../src/registry/integrations.ts";
import { CopyButton } from "./fx.tsx";
import { Seg } from "./Seg.tsx";

export default function McpSetup({ integration }: { integration: Integration }) {
  const [client, setClient] = useState<McpClient>("Claude Code");
  const code = mcpSetup(integration, client);
  return (
    <div className="overflow-hidden rounded-xl bg-s1 shadow-[inset_0_0_0_1px_var(--color-line)]">
      <div className="flex items-center gap-1 border-b border-line p-1.5">
        {/* Scrolls in narrow panes (the library page's 360px column) so Copy stays in view. */}
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
          <Seg label="Client">
            {mcpClients.map((c) => <button key={c} type="button" aria-pressed={client === c} onClick={() => setClient(c)}>{c}</button>)}
          </Seg>
        </div>
        <CopyButton value={code} quiet />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed text-fg/85">{code}</pre>
    </div>
  );
}
