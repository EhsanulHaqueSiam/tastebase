// Client-side: one shared fetch of /api/stats per page load, for islands that show live numbers.
import { useEffect, useState } from "react";
import type { Stats } from "../../../src/trending.ts";

let pending: Promise<Stats> | undefined;
export function useStats(): Stats | undefined {
  const [stats, setStats] = useState<Stats>();
  useEffect(() => {
    pending ??= fetch("/api/stats").then((r) => r.json() as Promise<Stats>).catch(() => ({}));
    pending.then(setStats);
  }, []);
  return stats;
}
