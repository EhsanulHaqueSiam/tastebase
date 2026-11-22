// Server-only: the /components index, grouped by component name. The page renders the first groups; the island
// fetches all of them (/components.json) when search is first used.
import { components } from "../../../src/registry/components.ts";
import type { Group } from "../components/Components.tsx";
import { libraries } from "./server.ts";

const byId = new Map(libraries.map((l) => [l.id, l]));
// "Date Picker", "DatePicker" and "date-picker" are one group.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function componentGroups() {
  const groups = new Map<string, Group>();
  for (const [id, list] of Object.entries(components)) {
    const lib = byId.get(id)!;
    for (const [name, url, aliases = []] of list) {
      const g = groups.get(norm(name)) ?? { name, terms: "", libs: [] };
      g.libs.push({ id, name: lib.name, kind: lib.kind, url });
      g.terms += ` ${name} ${aliases.join(" ")} ${lib.name}`.toLowerCase();
      groups.set(norm(name), g);
    }
  }
  // Parts most libraries ship first: they are the ones worth comparing.
  return [...groups.values()].sort((a, b) => b.libs.length - a.libs.length || a.name.localeCompare(b.name));
}
