// /f/<id>: one folder's libraries as cards. Anyone with the link sees a public folder; its owner also gets rename,
// private/public, copy link and delete. Ownership comes from the account store, so the server page stays cacheable.
import { Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { ShelfLib } from "../lib/server.ts";
import { deleteFolder, updateFolder, useAccount, type User } from "../lib/saved.ts";
import { Avatar } from "./AccountSheet.tsx";
import { CopyButton } from "./fx.tsx";
import { LibCard } from "./LibCard.tsx";

type Props = { id: string; name: string; public: boolean; owner: User; libs: ShelfLib[] };

export default function FolderView(p: Props) {
  const { folders } = useAccount();
  const mine = folders.find((f) => f.id === p.id);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(p.name);
  const [confirm, setConfirm] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(location.href), []);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  const name = mine?.name ?? p.name;
  // The owner filing a library out of this folder (from a card) drops it here at once.
  const libs = mine ? p.libs.filter((l) => mine.libs.includes(l.id)) : p.libs;

  const rename = (e: Pick<FormEvent, "preventDefault">) => {
    e.preventDefault();
    setRenaming(false);
    if (draft.trim() && draft.trim() !== name) updateFolder(p.id, { name: draft.trim() });
  };
  const remove = async () => {
    if (!confirm) return setConfirm(true);
    if (await deleteFolder(p.id)) location.assign("/folders");
  };

  return (
    <section aria-labelledby="folder-title" className="mx-auto max-w-[1440px] px-4 pt-[76px] pb-24 lg:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {renaming ? (
          <form onSubmit={rename} className="min-w-0 flex-[0_1_420px]">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={rename}
              onKeyDown={(e) => e.key === "Escape" && (setDraft(name), setRenaming(false))}
              maxLength={60}
              aria-label="Folder name"
              className="h-[34px] w-full rounded-[9px] bg-s2 px-2.5 text-[18px] font-semibold tracking-[-0.02em] shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)] outline-none focus-visible:outline-none"
            />
          </form>
        ) : (
          <h1 id="folder-title" className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.02em]">
            {name} <span className="ml-1 font-mono text-[13px] font-medium text-fg3 tabular-nums">{libs.length}</span>
          </h1>
        )}
        <span className="flex items-center gap-2 text-[13px] text-fg2">
          <Avatar user={p.owner} size={20} />
          {p.owner.name}
        </span>

        {mine && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5 max-sm:ml-0 max-sm:basis-full">
            <button type="button" onClick={() => (setDraft(name), setRenaming(true))} className="press h-8 rounded-lg bg-s3 px-2.5 text-[12.5px] font-medium text-fg2 hover:bg-fg hover:text-bg">Rename</button>
            <div className="seg" role="group" aria-label="Who can see this folder">
              <button type="button" aria-pressed={!mine.public} onClick={() => updateFolder(p.id, { public: false })}>Private</button>
              <button type="button" aria-pressed={mine.public} onClick={() => updateFolder(p.id, { public: true })}>Anyone with the link</button>
            </div>
            {mine.public && url && <CopyButton value={url} label="Copy link" />}
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
        )}
      </div>

      {libs.length ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {libs.map((l) => <LibCard key={l.id} lib={l} />)}
        </div>
      ) : (
        <p className="mt-16 text-center text-fg2">{mine ? "Empty for now. Use the folder button on any library to add it here." : "Nothing in this folder yet."}</p>
      )}
    </section>
  );
}
