// The registry: every curated library plus the look guides. Add a library by adding an entry to a data file.
import aestheticsData from "./aesthetics.ts";
import kits from "./data/kits.ts";
import motion from "./data/motion.ts";
import visuals from "./data/visuals.ts";
import stats from "./stats.json" with { type: "json" };
import type { Aesthetic, Library } from "./schema.ts";

const statsById: Record<string, Library["stats"]> = stats;

const all: Library[] = [...kits, ...motion, ...visuals];

export const libraries: Library[] = all.map((l) => ({ ...l, stats: statsById[l.id] ?? l.stats }));
export const aesthetics: Aesthetic[] = aestheticsData;
