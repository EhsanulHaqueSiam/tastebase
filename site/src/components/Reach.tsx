// /sponsor's reach row: listings we show, and agent picks and GitHub stars gained this week (live from /api/stats).
import NumberFlow from "@number-flow/react";
import { useStats } from "../lib/stats.ts";

export default function Reach({ listings }: { listings: number }) {
  const stats = useStats();
  const sum = (k: "agentUses" | "starsWeek") => Object.values(stats ?? {}).reduce((n, s) => n + (s?.[k] ?? 0), 0);
  // A live number shows only once it has a value; a fresh deploy has no stats yet.
  const tiles = ([[listings, "Listings"], [sum("agentUses"), "Agent picks this week"], [sum("starsWeek"), "Stars gained by listed libraries this week"]] as const).filter(([n]) => n > 0);
  return (
    <>
      <h2 className="mt-8 font-mono text-[11px] font-medium tracking-[0.12em] text-fg3 uppercase">Reach</h2>
      <div className="mt-3 grid auto-cols-fr grid-flow-col gap-2">
        {tiles.map(([n, label]) => (
          <div key={label} className="rounded-xl bg-s1 p-3.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
            <NumberFlow value={n} className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums" />
            <p className="mt-0.5 text-[12px] leading-tight text-fg2">{label}</p>
          </div>
        ))}
      </div>
    </>
  );
}
