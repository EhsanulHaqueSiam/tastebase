// The registry: every curated library plus the look guides. Add a library by adding an entry to a data file.
// Live stats (stars, downloads) are not here; the Worker's cron keeps them in KV (see src/trending.ts).
import families from "./aesthetics.ts";
import kits from "./data/kits.ts";
import motion from "./data/motion.ts";
import themed from "./data/themed.ts";
import visuals from "./data/visuals.ts";
import expressive from "./looks/expressive.ts";
import surfaces from "./looks/surfaces.ts";
import typeLayout from "./looks/type-layout.ts";
import type { Aesthetic, Library, SiteType, Style } from "./schema.ts";
import sitesData from "./sites.ts";

export const libraries: Library[] = [...kits, ...themed.map((l) => ({ ...l, themed: true as const })), ...motion, ...visuals];

const styles: Style[] = [...surfaces, ...typeLayout, ...expressive];
const familyById = new Map(families.map((f) => [f.id, f]));
/** Families first, then styles with their family's picks filled in for every kind they leave out, and its needs unless they set their own. */
export const aesthetics: Aesthetic[] = [
  ...families,
  ...styles.map((s) => ({ ...s, picks: { ...familyById.get(s.family)?.picks, ...s.picks }, needs: s.needs ?? familyById.get(s.family)?.needs })),
];
export const siteTypes: SiteType[] = sitesData;
