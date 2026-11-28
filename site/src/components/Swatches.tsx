// A design's palette on its detail page: one chip per colour; clicking one copies its hex.
import { toast } from "sonner";
import { haptic } from "../lib/haptics.ts";

export default function Swatches({ colors }: { colors: string[] }) {
  const copy = async (hex: string) => {
    await navigator.clipboard?.writeText(hex).catch(() => {});
    haptic("success");
    toast("Copied", { description: hex });
  };
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Palette">
      {colors.map((c) => (
        <li key={c}>
          <button type="button" onClick={() => copy(c)} className="press inline-flex h-7 items-center gap-1.5 rounded-lg pr-2 pl-1 font-mono text-[11.5px] text-fg2 shadow-[inset_0_0_0_1px_var(--color-line2)] hover:text-fg" aria-label={`Copy ${c}`}>
            <i className="size-5 rounded-md shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]" style={{ background: c }} />
            {c}
          </button>
        </li>
      ))}
    </ul>
  );
}
