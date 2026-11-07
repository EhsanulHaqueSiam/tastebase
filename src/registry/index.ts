// The registry: every curated library plus the look guides. Add a library by adding an entry to a data file.
// Live stats (stars, downloads) are not here; the Worker's cron keeps them in KV (see src/trending.ts).
import aestheticsData from "./aesthetics.ts";
import kits from "./data/kits.ts";
import motion from "./data/motion.ts";
import visuals from "./data/visuals.ts";
import type { Aesthetic, Library } from "./schema.ts";

export const libraries: Library[] = [...kits, ...motion, ...visuals];
export const aesthetics: Aesthetic[] = aestheticsData;
