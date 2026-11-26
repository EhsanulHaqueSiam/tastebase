// /f/<id>: one folder's libraries as cards. Anyone with the link sees a public folder; its owner also gets rename,
// private/public, copy link and delete (FolderControls, as in the dashboard). Ownership comes from the account store, so the server page stays cacheable.
import type { ShelfLib } from "../lib/server.ts";
import { useAccount, type User } from "../lib/saved.ts";
import { Avatar } from "./AccountSheet.tsx";
import { FolderControls } from "./FolderControls.tsx";
import { LibCard } from "./LibCard.tsx";

type Props = { id: string; name: string; public: boolean; owner: User; libs: ShelfLib[] };

export default function FolderView(p: Props) {
  const { folders } = useAccount();
  const mine = folders.find((f) => f.id === p.id);
  const name = mine?.name ?? p.name;
  // The owner filing a library out of this folder (from a card) drops it here at once.
  const libs = mine ? p.libs.filter((l) => mine.libs.includes(l.id)) : p.libs;
  const title = (
    <h1 id="folder-title" className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.02em]">
      {name} <span className="ml-1 font-mono text-[13px] font-medium text-fg3 tabular-nums">{libs.length}</span>
    </h1>
  );
  const owner = (
    <span className="flex items-center gap-2 text-[13px] text-fg2">
      <Avatar user={p.owner} size={20} />
      {p.owner.name}
    </span>
  );

  return (
    <section aria-labelledby="folder-title" className="mx-auto max-w-[1440px] px-4 pt-[76px] pb-24 lg:px-6">
      {mine ? (
        <FolderControls folder={mine} title={<>{title}{owner}</>} onDeleted={() => location.assign("/account#folders")} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">{title}{owner}</div>
      )}

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
