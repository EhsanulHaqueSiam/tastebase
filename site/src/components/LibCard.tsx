// The library card shared by the home shelf and the /browse directory, plus the sort and save pieces both use.
import { Heart } from "lucide-react";
import { memo, useState, type CSSProperties } from "react";
import type { Framework, Kind } from "../../../src/registry/schema.ts";
import type { Stats } from "../../../src/trending.ts";
import { haptic } from "../lib/haptics.ts";
import { kindMeta, shot } from "../lib/kinds.ts";
import { toggleSaved, useSaved } from "../lib/saved.ts";
import type { ShelfLib } from "../lib/server.ts";
import FolderPicker from "./FolderPicker.tsx";
import { CopyButton, SpotCard } from "./fx.tsx";
import { GithubMark } from "./GithubMark.tsx";
import { LibMark } from "./LibMark.tsx";

export const SORTS = [
  ["hot", "Hot this week", "hottest this week first"],
  ["stars", "Stars", "most stars first"],
  ["agents", "Used by agents", "most used by agents this week first"],
  ["name", "A to Z", "A to Z"],
] as const;
export type Sort = (typeof SORTS)[number][0];
export const FW: Record<Framework, string> = { react: "React", vue: "Vue", svelte: "Svelte", solid: "Solid", angular: "Angular", vanilla: "Vanilla JS", "react-native": "React Native" };
export const compact = new Intl.NumberFormat("en", { notation: "compact" });

/** Comparator for a sort; missing stats count as zero, so libraries without numbers sink. */
export function sortBy(sort: Sort, stats: Stats | undefined) {
  const n = (id: string, k: "stars" | "starsWeek" | "agentUses") => stats?.[id]?.[k] ?? 0;
  return {
    hot: (a: ShelfLib, b: ShelfLib) => n(b.id, "starsWeek") - n(a.id, "starsWeek") || n(b.id, "stars") - n(a.id, "stars"),
    stars: (a: ShelfLib, b: ShelfLib) => n(b.id, "stars") - n(a.id, "stars"),
    agents: (a: ShelfLib, b: ShelfLib) => n(b.id, "agentUses") - n(a.id, "agentUses") || n(b.id, "stars") - n(a.id, "stars"),
    name: (a: ShelfLib, b: ShelfLib) => a.name.localeCompare(b.name),
  }[sort];
}

/** The live number a sort is about: weekly gain for hot, total for stars, agent uses, nothing for A to Z. */
export function statBadge(sort: Sort, s: Stats[string] | undefined) {
  if (sort === "hot") return s?.starsWeek ? `+${compact.format(s.starsWeek)}★ wk` : "";
  if (sort === "agents") return s?.agentUses ? `${compact.format(s.agentUses)} agent uses wk` : "";
  return sort === "stars" && s?.stars ? `${compact.format(s.stars)}★` : "";
}

/** A kind's icon in its colour; it plays its hover motion when an `.anim-host` ancestor is hovered. */
export function KindIcon({ kind, size = 15 }: { kind: Kind; size?: number }) {
  const m = kindMeta[kind];
  return (
    <span data-anim={m.anim} className="grid shrink-0 place-items-center" style={{ color: m.color }}>
      <m.icon size={size} aria-hidden />
    </span>
  );
}

// Seven spokes of paired confetti for the save burst, from Bencho's Like block.
const CONFETTI = ["#f48ea7", "#cc8ef5", "#8ce8c3", "#91d2fa", "#f5a524", "#e5484d", "#9fc7fa"];

/** Heart toggle for one library; saved ids live in the account when signed in, else localStorage (lib/saved.ts). Saving blooms and bursts (.lk-* in
 *  styles.css, after Bencho's Like) and gives a success haptic on phones; unsaving is quiet. */
export function SaveButton({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  const on = useSaved().includes(id);
  const [beat, setBeat] = useState(0); // a fresh key per save, so each one replays once and a page load never does
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Unsave ${name}` : `Save ${name}`}
      onClick={() => {
        if (!on) setBeat((b) => b + 1), haptic("success");
        toggleSaved(id);
      }}
      className={`press grid size-8 place-items-center rounded-lg transition-colors ${on ? "text-pink" : "text-fg2 hover:text-fg"} ${className}`}
    >
      <span className="lk-heart">
        <span key={on && beat ? beat : "rest"} className="lk-glyph" data-on={(on && beat > 0) || undefined}>
          <Heart size={15} fill={on ? "currentColor" : "none"} aria-hidden />
        </span>
        {on && beat > 0 && (
          <span key={beat} className="lk-burst" aria-hidden>
            <span className="lk-bloom" />
            {CONFETTI.map((c, k) => (
              <span key={c} className="lk-spoke" style={{ "--a": `${k * (360 / 7) - 90}deg` } as CSSProperties}>
                <i style={{ "--c": c } as CSSProperties} />
                <i style={{ "--c": CONFETTI[(k + 3) % 7] } as CSSProperties} />
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

/** Screenshot card: links to the library page; install, GitHub, folder and save sit outside the link. */
// Memoized: the directory keeps every card mounted and re-renders on each filter change.
export const LibCard = memo(function LibCard({ lib, badge, pick }: { lib: ShelfLib; badge?: string; pick?: boolean }) {
  return (
    <div className="anim-host group relative">
      <a href={`/browse/${lib.id}`} className="block">
        <SpotCard className="overflow-hidden rounded-2xl bg-s1 shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow duration-300 group-hover:shadow-[inset_0_0_0_1px_var(--color-line2)]">
          <div className="relative aspect-[16/10] overflow-hidden bg-s2">
            <img src={shot(lib.id)} alt={`${lib.name} website`} loading="lazy" className="size-full object-cover object-top transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]" />
            <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-s1 to-transparent" />
            {badge && <span className="absolute top-2.5 left-2.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[11px] font-medium text-fg backdrop-blur-md">{badge}</span>}
            {pick && <span className="absolute top-3 right-12 rounded-md bg-fg px-1.5 py-0.5 font-mono text-[11px] font-medium text-bg">pick</span>}
          </div>
          <div className="flex items-center gap-3 p-4 pt-1">
            <LibMark lib={lib} size={30} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{lib.name}</span>
              <span className="block truncate text-[13px] text-fg2">{lib.tagline}</span>
            </span>
            <span className="card-kind shrink-0 font-mono text-[11.5px] text-fg3">{kindMeta[lib.kind].short}</span>
          </div>
        </SpotCard>
      </a>
      <SaveButton id={lib.id} name={lib.name} className="absolute top-2 right-2 bg-black/55 backdrop-blur-md" />
      {/* Outside the link so the buttons are not nested in it; they sit over the kind label. */}
      <div className="card-acts absolute right-3 bottom-[15px] flex gap-1 bg-[linear-gradient(to_left,var(--color-s1)_75%,transparent)] pl-8">
        <CopyButton value={lib.install} label="Install" className="h-8" />
        {lib.repo && (
          <a href={lib.repo} target="_blank" rel="noreferrer" aria-label={`${lib.name} on GitHub`} className="press grid size-8 place-items-center rounded-lg bg-s3 text-fg2 hover:bg-fg hover:text-bg">
            <GithubMark size={14} />
          </a>
        )}
        <FolderPicker id={lib.id} name={lib.name} />
      </div>
    </div>
  );
});
