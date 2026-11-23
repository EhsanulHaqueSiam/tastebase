// A look's page (/looks/<id>): make it the user's look, and mark one of its picks wrong for it. Both write through the
// account store; signed out, the look stays in this browser and marking asks to sign in.
import { Check, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { haptic } from "../lib/haptics.ts";
import { setPrefs, toggleOffLook, useAccount, type OffLook } from "../lib/saved.ts";

export function UseLook({ id, name }: { id: string; name: string }) {
  const { user, look } = useAccount();
  const mine = look === id;
  const use = () => {
    haptic(mine ? "selection" : "success");
    setPrefs({ look: mine ? null : id });
    if (!mine) toast(`${name} is your look`, { description: user ? "Your agent builds in it when a brief names no look." : "Saved in this browser. Sign in so your agent uses it." });
  };
  return (
    <button type="button" aria-pressed={mine} onClick={use} className={`press inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold ${mine ? "bg-s3 text-fg shadow-[inset_0_0_0_1px_var(--color-line2)]" : "bg-fg text-bg"}`}>
      {mine && <Check size={14} aria-hidden />}
      {mine ? "Your look" : "Use as my look"}
    </button>
  );
}

export function OffLookToggle({ item }: { item: OffLook }) {
  const { offLook } = useAccount();
  const on = offLook.some((o) => o.id === item.id && o.look === item.look);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => (haptic("selection"), toggleOffLook(item))}
      title={on ? "Your agent leaves it out under this look. Undo" : "Your agent leaves it out under this look only"}
      className={`press inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-medium ${on ? "bg-s3 text-fg" : "text-fg3 hover:text-fg"}`}
    >
      <EyeOff size={13} aria-hidden />
      {on ? "Left out · Undo" : "Not for this look"}
    </button>
  );
}
