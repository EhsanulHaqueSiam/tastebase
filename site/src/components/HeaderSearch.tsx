// Header search: the pill grows into an input in place (.island in styles.css). Enter or ⌘K hands the text to the
// ⌘K palette (Palette.tsx listens for "tb:search"). Phones skip the input and open the palette straight away.
import { Search } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const toPalette = (q: string) => window.dispatchEvent(new CustomEvent("tb:search", { detail: q }));

export default function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => void (open && input.current?.focus()), [open]); // after render: the pane is inert until open

  const grow = () => {
    if (matchMedia("(max-width: 639px)").matches) return toPalette("");
    setOpen(true);
  };
  const shrink = () => (setOpen(false), input.current && (input.current.value = ""));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return shrink();
    if (e.key === "Enter" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      e.stopPropagation(); // keep the palette's own ⌘K toggle from closing it again
      toPalette(e.currentTarget.value);
      shrink();
    }
  };

  return (
    <div className="island" data-open={open || undefined}>
      <button type="button" onClick={grow} aria-label="Search" inert={open} className="island-pane justify-center text-fg2 hover:text-fg">
        <Search size={14} /> <span className="hidden sm:inline">Search</span> <span className="kbd hidden sm:inline">⌘K</span>
      </button>
      <label className="island-pane gap-2 pr-1.5 pl-3" inert={!open}>
        <Search size={14} className="shrink-0 text-fg3" />
        <input ref={input} onKeyDown={onKey} onBlur={shrink} placeholder="toast, bottom sheet, claymorphism" aria-label="Search libraries" autoComplete="off" spellCheck={false} className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg3 focus-visible:outline-none" />
        <span className="kbd">esc</span>
      </label>
    </div>
  );
}
