// A folder's owner controls: its name (click Rename to edit in place), private or anyone-with-the-link, copy link and
// delete (asks once). Shared by the dashboard's Folders panel and /f/<id>, so both manage a folder the same way.
import { Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { deleteFolder, updateFolder, type Folder } from "../lib/saved.ts";
import { CopyButton } from "./fx.tsx";

/** `title`: the heading as it reads when not renaming. `onDeleted`: where to go once the folder is gone. */
export function FolderControls({ folder, title, onDeleted }: { folder: Folder; title: ReactNode; onDeleted: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);
  useEffect(() => {
    setRenaming(false);
    setConfirm(false);
  }, [folder.id]);

  const rename = (e: Pick<FormEvent, "preventDefault">) => {
    e.preventDefault();
    setRenaming(false);
    if (draft.trim() && draft.trim() !== folder.name) updateFolder(folder.id, { name: draft.trim() });
  };
  const remove = async () => {
    if (!confirm) return setConfirm(true);
    if (await deleteFolder(folder.id)) onDeleted();
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {renaming ? (
        <form onSubmit={rename} className="min-w-0 flex-[0_1_420px]">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === "Escape" && (setDraft(folder.name), setRenaming(false))}
            maxLength={60}
            aria-label="Folder name"
            className="h-[34px] w-full rounded-[9px] bg-s2 px-2.5 text-[17px] font-semibold tracking-[-0.02em] shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)] outline-none focus-visible:outline-none"
          />
        </form>
      ) : (
        title
      )}
      <div className="ml-auto flex flex-wrap items-center gap-1.5 max-sm:ml-0 max-sm:basis-full">
        <button type="button" onClick={() => (setDraft(folder.name), setRenaming(true))} className="press h-8 rounded-lg bg-s3 px-2.5 text-[12.5px] font-medium text-fg2 hover:bg-fg hover:text-bg">Rename</button>
        <div className="seg" role="group" aria-label="Who can see this folder">
          <button type="button" aria-pressed={!folder.public} onClick={() => updateFolder(folder.id, { public: false })}>Private</button>
          <button type="button" aria-pressed={folder.public} onClick={() => updateFolder(folder.id, { public: true })}>Anyone with the link</button>
        </div>
        {folder.public && <CopyButton value={`${location.origin}/f/${folder.id}`} label="Copy link" />}
        <button
          type="button"
          onClick={remove}
          aria-label={confirm ? "Confirm delete" : "Delete folder"}
          className={`press inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium ${confirm ? "bg-[#e5484d] text-white" : "bg-s3 text-fg2 hover:text-fg"}`}
        >
          <Trash2 size={14} aria-hidden />
          {confirm ? "Delete?" : ""}
        </button>
      </div>
    </div>
  );
}
