// A signed-in user's taste: what they hid, hearted or marked off-look, read from their agent key (site/src/pages/mcp.ts)
// and saved through the `taste` tool or the site's hide button. Ids are a library or resource id, or `library/part`
// for one part of a kit ("kokonut-ui/pull-cord"): the part's name in lowercase, dashes for the rest.
import type { Framework, Library } from "./registry/schema.ts";

export const tasteActions = ["hide", "like", "off-look", "undo"] as const;
export type TasteAction = (typeof tasteActions)[number];

/** `hide`: never offered. `like`: hearted, a slight lead in plan and pick. `offLook`: look id -> ids never offered under
 *  that look. `look`, `framework`: the user's defaults, used only when the call and the brief name none. `save`: stores
 *  one change for the key's owner; absent without a key. */
export type Taste = {
  hide: ReadonlySet<string>;
  like: ReadonlySet<string>;
  offLook?: ReadonlyMap<string, ReadonlySet<string>>;
  look?: string;
  framework?: Framework;
  save?: (id: string, action: TasteAction, look?: string) => Promise<void>;
};

export const partSlug = (part: string) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The library and part a `library/part` id names, or undefined. */
export function partOf(libs: readonly Library[], id: string) {
  const [libId, slug, extra] = id.split("/");
  const lib = slug && extra === undefined ? libs.find((l) => l.id === libId) : undefined;
  const part = lib && [...(lib.parts?.free ?? []), ...(lib.parts?.paid ?? [])].find((p) => partSlug(p) === slug);
  return part ? { lib: lib!, part } : undefined;
}

/** `libs` without the ids in `hide`: a library id drops the library and its features (GSAP drops GSAP SplitText); a part
 *  id drops that part from its kit, and from the kit's own install and usage when they show it (Kokonut's install adds
 *  its Hold Button). */
export function without(libs: Library[], hide: ReadonlySet<string> | undefined): Library[] {
  if (!hide?.size) return libs;
  return libs.flatMap((l) => {
    if (hide.has(l.id) || (l.partOf && hide.has(l.partOf))) return [];
    const gone = l.parts ? [...l.parts.free, ...(l.parts.paid ?? [])].filter((p) => hide.has(`${l.id}/${partSlug(p)}`)) : [];
    if (!gone.length) return [l];
    const keep = (ps: string[]) => ps.filter((p) => !gone.includes(p));
    const alt = gone.map(partSlug).join("|");
    const slugs = new RegExp(`(?<=/)(${alt})(?![\\w-])`);
    const shows = (s: string) => slugs.test(s) || gone.some((p) => s.includes(p.replace(/\s+/g, "")));
    return [
      {
        ...l,
        parts: { free: keep(l.parts!.free), ...(l.parts!.paid && { paid: keep(l.parts!.paid) }) },
        // "add @kokonutui/hold-button" becomes "add @kokonutui/<part>"; shadcn's "add button card input" drops button.
        install: l.install.replace(new RegExp(` (${alt})(?![\\w-])`, "g"), "").replace(slugs, "<part>").replace(/ add$/, " add <part>"),
        ...(shows(l.usage) && { usage: `(its example shows ${gone.join(", ")}, which the user does not want: follow the docs of the part you use)` }),
      },
    ];
  });
}
