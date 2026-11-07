import NumberFlow from "@number-flow/react";
import { useStats } from "../lib/stats.ts";

/** Live stars and downloads on a prerendered library page; the numbers roll in once loaded. */
export default function Adoption({ id }: { id: string }) {
  const s = useStats()?.[id];
  if (!s?.stars && !s?.downloadsWeek) return null;
  return (
    <>
      <h5 className="mt-6 mb-2 text-[13px] font-semibold">Adoption</h5>
      <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px] tabular-nums">
        {s.stars ? (<><dt className="text-fg3">GitHub stars</dt><dd><NumberFlow value={s.stars} />{s.starsWeek ? <span className="text-green"> +{s.starsWeek} this week</span> : null}</dd></>) : null}
        {s.downloadsWeek ? (<><dt className="text-fg3">npm / week</dt><dd><NumberFlow value={s.downloadsWeek} /></dd></>) : null}
      </dl>
    </>
  );
}
