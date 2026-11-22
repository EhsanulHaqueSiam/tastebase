// Header search: the pill grows into an input in place (.island in styles.css). Enter or ⌘K hands the text to the
// ⌘K palette (Palette.tsx listens for "tb:search"). Phones skip the input and open the palette straight away.
import { Search } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";

const toPalette = (q: string) => window.dispatchEvent(new CustomEvent("tb:search", { detail: q }));

export default function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  useEffect(() => void (open && input.current?.focus()), [open]); // after render: the pane is inert until open

  const grow = () => {
    if (matchMedia("(max-width: 639px)").matches) return toPalette("");
    setOpen(true);
  };
  const shrink = () => (setOpen(false), input.current && (input.current.value = ""));
  // Focus goes back to the pill (no longer inert once shrunk), so Esc here or in the palette lands somewhere.
  const back = () => (flushSync(shrink), pill.current?.focus());
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return back();
    if (e.key === "Enter" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      e.stopPropagation(); // keep the palette's own ⌘K toggle from closing it again
      const q = e.currentTarget.value;
      back(); // before the palette opens, so it records the pill as what to return to
      toPalette(q);
    }
  };

  return (
    <div className="island" data-open={open || undefined}>
      <button ref={pill} type="button" onClick={grow} inert={open} className="island-pane justify-center text-fg2 hover:text-fg">
        <Search size={14} aria-hidden /> <span className="sr-only sm:not-sr-only">Search</span> <span className="kbd hidden sm:inline" aria-hidden>⌘K</span>
      </button>
      <label className="island-pane gap-2 pr-1.5 pl-3" inert={!open}>
        <Search size={14} className="shrink-0 text-fg3" />
        <input ref={input} onKeyDown={onKey} onBlur={shrink} placeholder="toast, bottom sheet, claymorphism" aria-label="Search libraries" autoComplete="off" spellCheck={false} className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg3 focus-visible:outline-none" />
        <span className="kbd" aria-hidden>esc</span>
      </label>
    </div>
  );
}
