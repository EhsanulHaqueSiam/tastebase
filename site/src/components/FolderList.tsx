// /folders: the signed-in user's folders as cards (a mosaic of the first four libraries' screenshots), and a field to
// make one. Signed out, a prompt to sign in. Reads the account store; the page itself is static.
import { FolderPlus, Globe } from "lucide-react";
import { useState, type FormEvent } from "react";
import { haptic } from "../lib/haptics.ts";
import { shot } from "../lib/kinds.ts";
import { askSignIn, createFolder, useAccount } from "../lib/saved.ts";

const MOSAIC = ["grid-cols-1", "grid-cols-1", "grid-cols-2", "m3 grid-cols-2 grid-rows-2", "grid-cols-2 grid-rows-2"];

export default function FolderList() {
  const { user, loading, folders } = useAccount();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    if (await createFolder(draft)) setDraft(""), haptic("success");
    setBusy(false);
  };

  return (
    <section aria-labelledby="folders-title" className="mx-auto max-w-[1440px] px-4 pt-[76px] pb-24 lg:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 id="folders-title" className="text-[18px] font-semibold tracking-[-0.02em]">
          Folders {user && <span className="ml-1 font-mono text-[13px] font-medium text-fg3 tabular-nums">{folders.length}</span>}
        </h1>
        {user && (
          <form onSubmit={create} className="ml-auto flex min-w-0 flex-[0_1_340px] items-center gap-1.5 max-sm:basis-full">
            <label className="flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-[9px] bg-s2 px-2.5 shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)]">
              <FolderPlus size={14} className="shrink-0 text-fg3" aria-hidden />
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} placeholder="New folder" aria-label="New folder name" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg3 focus-visible:outline-none" />
            </label>
            <button type="submit" disabled={!draft.trim() || busy} className="press h-[34px] rounded-[9px] bg-fg px-3 text-[13px] font-medium text-black disabled:opacity-40">Create</button>
          </form>
        )}
      </div>

      {!user ? (
        !loading && (
          <div className="mt-16 grid justify-items-center text-center">
            <p className="max-w-[340px] text-fg2">Sign in to group libraries into folders, keep them on every device and share one with a link.</p>
            <button type="button" onClick={askSignIn} className="press mt-5 h-10 rounded-xl bg-fg px-4 text-[14px] font-semibold text-black active:scale-95">Sign in with GitHub</button>
          </div>
        )
      ) : folders.length === 0 ? (
        <p className="mt-16 text-center text-fg2">No folders yet. Name one above, or use the folder button on any library.</p>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {folders.map((f) => (
            <li key={f.id}>
              <a href={`/f/${f.id}`} className="group block overflow-hidden rounded-2xl bg-s1 shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow duration-300 hover:shadow-[inset_0_0_0_1px_var(--color-line2)]">
                {/* One screenshot fills the tile, two split it, three or more make a 2x2 (the first spans both rows at three). */}
                <div className={`grid aspect-[16/10] gap-px overflow-hidden bg-line ${MOSAIC[Math.min(f.libs.length, 4)]}`}>
                  {f.libs.length ? (
                    f.libs.slice(0, 4).map((lib) => (
                      <span key={lib} className="overflow-hidden bg-s2 [.m3_&:first-child]:row-span-2">
                        <img src={shot(lib)} alt="" loading="lazy" className="size-full object-cover object-top transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]" />
                      </span>
                    ))
                  ) : (
                    <span className="bg-s2" />
                  )}
                </div>
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                  {f.public && <Globe size={13} className="shrink-0 text-fg3" aria-label="Public" />}
                  <span className="font-mono text-[12px] text-fg3 tabular-nums">{f.libs.length}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
