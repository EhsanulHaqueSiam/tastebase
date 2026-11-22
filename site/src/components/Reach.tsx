// /sponsor's numbers line: what we list (build time), then agent picks and GitHub stars gained this week (/api/stats).
// Page views and visitors stay off until they help the pitch.
import NumberFlow from "@number-flow/react";
import { useStats } from "../lib/stats.ts";

type Props = { libraries: number; resources: number; looks: number };

export default function Reach({ libraries, resources, looks }: Props) {
  const stats = useStats();
  const sum = (k: "agentUses" | "starsWeek") => Object.values(stats ?? {}).reduce((n, s) => n + (s?.[k] ?? 0), 0);
  // A live number shows only once it has a value; a fresh deploy has no stats yet.
  const items = (
    [
      [libraries, "libraries"],
      [resources, "design resources"],
      [looks, "looks"],
      [sum("agentUses"), "agent picks this week"],
      [sum("starsWeek"), "stars gained by listed libraries this week"],
    ] as const
  ).filter(([n]) => n > 0);
  return (
    <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-fg3 tabular-nums">
      {items.map(([n, label]) => (
        <span key={label}>
          <NumberFlow value={n} className="font-medium text-fg" /> {label}
        </span>
      ))}
    </p>
  );
}
