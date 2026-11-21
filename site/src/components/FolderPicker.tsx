// "Add to folder" for one library, on its card and its page. Opens a sheet of the user's folders, each a toggle, plus
// a field that makes a new folder with this library in it. Signed out, it asks them to sign in first.
import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { haptic } from "../lib/haptics.ts";
import { useIconHover } from "../lib/nav.ts";
import { askSignIn, createFolder, updateFolder, useAccount } from "../lib/saved.ts";
import { Sheet } from "./AccountSheet.tsx";
import { FolderPlusIcon } from "./icons/folder-plus.tsx";

export default function FolderPicker({ id, name, label, className = "" }: { id: string; name: string; label?: boolean; className?: string }) {
  const { user, folders } = useAccount();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const { ref, on: hover } = useIconHover();
  const filed = folders.some((f) => f.libs.includes(id));

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    if (await createFolder(draft, id)) setDraft(""), haptic("success");
    setBusy(false);
  };

  return (
    <>
      <button
        type="button"
        {...hover}
        onClick={() => (user ? (setOpen(true), haptic("light")) : askSignIn())}
        aria-label={`Add ${name} to a folder`}
        className={`press inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-s3 hover:bg-fg hover:text-black ${label ? "px-2.5 text-[12.5px] font-medium" : "w-8"} ${filed ? "text-fg" : "text-fg2"} ${className}`}
      >
        <FolderPlusIcon ref={ref} size={14} className="grid place-items-center" />
        {label && (filed ? "In a folder" : "Add to folder")}
      </button>

      <Sheet open={open} onOpenChange={setOpen} title={`Add ${name} to`}>
        {folders.length > 0 && (
          <ul className="-mx-1 grid max-h-[50svh] gap-1 overflow-y-auto px-1">
            {folders.map((f) => {
              const on = f.libs.includes(id);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => (haptic("selection"), updateFolder(f.id, on ? { remove: id } : { add: id }))}
                    className={`flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-[16px] font-semibold transition-[transform,background-color] active:scale-[0.97] ${on ? "bg-s3 text-fg" : "text-fg2 hover:bg-s3/60 hover:text-fg"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="font-mono text-[12.5px] font-medium text-fg3 tabular-nums">{f.libs.length}</span>
                    <span className={`grid size-5 place-items-center rounded-full transition-[background-color,box-shadow] duration-200 ${on ? "bg-fg text-black" : "shadow-[inset_0_0_0_1.5px_var(--color-line2)]"}`}>
                      {on && <Check size={13} strokeWidth={3} aria-hidden />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form onSubmit={create} className={`flex items-center gap-2 ${folders.length ? "mt-3 border-t border-line pt-3" : ""}`}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={60}
            placeholder={folders.length ? "New folder" : "Name your first folder"}
            aria-label="New folder name"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-2xl bg-s3 px-4 text-[16px] text-fg outline-none placeholder:text-fg3 focus-visible:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)] focus-visible:outline-none"
          />
          <button type="submit" disabled={!draft.trim() || busy} className="press h-12 rounded-2xl bg-fg px-4 text-[15px] font-semibold text-black active:scale-95 disabled:opacity-40">
            Create
          </button>
        </form>
      </Sheet>
    </>
  );
}
