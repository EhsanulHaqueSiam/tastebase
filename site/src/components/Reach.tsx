// /sponsor's reach row: listings we show, page views and visitors over 30 days (/api/views), and agent picks and GitHub
// stars gained this week (/api/stats).
import NumberFlow from "@number-flow/react";
import { useStats } from "../lib/stats.ts";
import { useViews } from "../lib/views.ts";

export default function Reach({ listings }: { listings: number }) {
  const stats = useStats();
  const views = useViews();
  const sum = (k: "agentUses" | "starsWeek") => Object.values(stats ?? {}).reduce((n, s) => n + (s?.[k] ?? 0), 0);
  // A live number shows only once it has a value; a fresh deploy has no stats yet.
  const tiles = (
    [
      [listings, "Listings"],
      [views?.views ?? 0, "Page views, last 30 days"],
      [views?.visitors ?? 0, "Visitors, last 30 days"],
      [sum("agentUses"), "Agent picks this week"],
      [sum("starsWeek"), "Stars gained by listed libraries this week"],
    ] as const
  ).filter(([n]) => n > 0);
  return (
    <>
      <h2 className="mt-8 font-mono text-[11px] font-medium tracking-[0.12em] text-fg3 uppercase">Reach</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
