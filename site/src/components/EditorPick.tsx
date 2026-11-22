// A detail page's editor's pick: the owner's one-line reason under the description, and for admins the toggle beside
// "Add to folder" that picks, re-words or unpicks it (lib/picks.ts).
import { useState, type FormEvent } from "react";
import { haptic } from "../lib/haptics.ts";
import { setEditorPick, useEditorPick } from "../lib/picks.ts";
import { useAccount } from "../lib/saved.ts";

export function PickReason({ id }: { id: string }) {
  const reason = useEditorPick(id);
  if (!reason) return null;
  return (
    <p className="mt-3 max-w-[62ch] text-[14px] leading-snug text-fg2">
      <span className="font-semibold text-amber">★ Editor's pick.</span> {reason}
    </p>
  );
}

export function PickToggle({ id }: { id: string }) {
  const { admin } = useAccount();
  const reason = useEditorPick(id);
  const [draft, setDraft] = useState<string | null>(null); // null: the reason field is closed
  if (!admin) return null;

  const save = (e: FormEvent) => {
    e.preventDefault();
    const r = draft?.trim();
    if (!r) return;
    setDraft(null);
    haptic("success");
    void setEditorPick(id, r);
  };

  return (
    <>
      <button
        type="button"
        aria-expanded={draft !== null}
        onClick={() => setDraft(draft === null ? (reason ?? "") : null)}
        className={`press inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium ${reason ? "bg-amber/14 text-amber shadow-[inset_0_0_0_1px_rgb(245_176_65/0.5)]" : "bg-s3 text-fg2 hover:text-fg"}`}
      >
        {reason ? "★ Editor's pick · Edit reason" : "☆ Make editor's pick"}
      </button>
      {draft !== null && (
        <form onSubmit={save} className="flex basis-full items-center gap-1.5">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[9px] bg-s2 px-2.5 text-[13.5px] shadow-[inset_0_0_0_1px_var(--color-line)] focus-within:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)]">
            <span className="text-fg3">Why:</span>
            <input
              // Opened by a click on the toggle, so moving focus here is expected.
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
              maxLength={160}
              placeholder="One line on why it is good"
              aria-label="Why it is an editor's pick"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg3"
            />
          </label>
          <button type="submit" disabled={!draft.trim()} className="press h-9 rounded-[9px] bg-fg px-3 text-[13px] font-semibold text-bg disabled:opacity-40">
            Save
          </button>
          {reason && (
            <button type="button" onClick={() => (setDraft(null), void setEditorPick(id, null))} className="press h-9 rounded-[9px] px-3 text-[13px] text-fg2 hover:text-fg">
              Unpick
            </button>
          )}
        </form>
      )}
    </>
  );
}
