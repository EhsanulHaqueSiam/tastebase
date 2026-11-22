// /components: every listed component, grouped by name, so "Date Picker" shows each library that ships one.
import { ArrowUpRight, Search } from "lucide-react";
import { useRef, useState } from "react";
import type { Kind } from "../../../src/registry/schema.ts";
import { withUtm } from "../lib/utm.ts";
import { LibMark } from "./LibMark.tsx";

/** One component name and every library that documents it. `terms` is what search matches. */
export type Group = { name: string; terms: string; libs: { id: string; name: string; kind: Kind; url: string }[] };
type Shown = Omit<Group, "terms">;

export const SHOWN = 120;

/** `first`: the groups shown before any search, without terms. Search fetches every group once (/components.json);
 * until it arrives, a query matches the shown groups by name. */
export default function Components({ first, groupCount, parts, libCount }: { first: Shown[]; groupCount: number; parts: number; libCount: number }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState<Group[]>();
  const asked = useRef(false);
  const load = () => {
    if (asked.current) return;
    asked.current = true;
    fetch("/components.json").then((r) => (r.ok ? (r.json() as Promise<Group[]>) : Promise.reject(new Error(String(r.status))))).then(setAll, () => (asked.current = false));
  };
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => terms.every((t) => text.includes(t));
  const list: Shown[] = !terms.length ? first : all ? all.filter((g) => matches(g.terms)) : first.filter((g) => matches(`${g.name} ${g.libs.map((l) => l.name).join(" ")}`.toLowerCase()));
  const total = terms.length ? list.length : groupCount;
  return (
    <section className="mx-auto max-w-5xl px-4 pt-24 pb-24">
      <h1 className="text-[clamp(28px,3.6vw,40px)] leading-tight font-semibold tracking-[-0.035em]">
        Components <span className="font-mono text-[15px] font-medium text-fg3 tabular-nums">{parts}</span>
      </h1>
      <p className="mt-2 max-w-xl text-fg2">Each part, and every library of the {libCount} we index that documents it. Open the docs to try it. Coverage is partial: a missing library means not listed yet.</p>

      <label className="mt-6 flex h-10 items-center gap-2 rounded-[10px] bg-s2 px-3 shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)]">
        <Search size={15} className="shrink-0 text-fg3" />
        <input
          type="search"
          value={q}
          onFocus={load}
          onChange={(e) => (load(), setQ(e.target.value))}
          placeholder="Date picker, marquee, bottom sheet…"
          aria-label="Search components"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg3 [&::-webkit-search-cancel-button]:hidden"
        />
        <span aria-live="polite" className="font-mono text-[12px] text-fg3 tabular-nums">{total}</span>
      </label>

      <ul className="mt-4">
        {list.slice(0, SHOWN).map((g) => (
          <li key={g.name} className="flex flex-col gap-2 border-b border-line py-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="w-48 shrink-0 font-medium">{g.name}</span>
            <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {g.libs.map((l) => (
                <a key={l.id} href={withUtm(l.url, "components")} target="_blank" rel="noopener" className="press group inline-flex items-center gap-2 rounded-lg bg-s2 py-1 pr-2 pl-1 text-[13px] text-fg2 hover:bg-s3 hover:text-fg">
                  <LibMark lib={l} size={20} />
                  {l.name}
                  <ArrowUpRight size={12} className="text-fg3 group-hover:text-fg" />
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {total > SHOWN && <p className="py-6 text-center text-[13px] text-fg3">Showing {SHOWN} of {total}. Search to narrow it.</p>}
      {!list.length && <p className="py-16 text-center text-fg3">No listed component matches. Try the job instead, like “toast”, on <a href="/browse" className="text-fg hover:underline">Browse</a>.</p>}
    </section>
  );
}
