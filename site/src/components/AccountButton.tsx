// Header account control. Signed out: "Sign in", which opens the GitHub sign-in sheet (also opened by askSignIn() when
// a signed-out visitor reaches for a folder). Signed in: the avatar, which opens a sheet with folders, saved and sign out.
import { LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { haptic } from "../lib/haptics.ts";
import { useIconHover, type AnimatedIcon } from "../lib/nav.ts";
import { signIn, signOut, useAccount } from "../lib/saved.ts";
import { Avatar, Sheet } from "./AccountSheet.tsx";
import { GithubMark } from "./GithubMark.tsx";
import { FoldersIcon } from "./icons/folders.tsx";
import { HeartIcon } from "./icons/heart.tsx";
import { UserIcon } from "./icons/user.tsx";

export default function AccountButton() {
  const { user, loading, saved, folders } = useAccount();
  const [open, setOpen] = useState(false);
  const [going, setGoing] = useState(false);
  const { ref, on: hover } = useIconHover();
  useEffect(() => {
    const show = () => setOpen(true);
    addEventListener("tb:signin", show);
    return () => removeEventListener("tb:signin", show);
  }, []);

  const toggle = (o: boolean) => (setOpen(o), o && haptic("light"));
  const shell = "press grid h-[34px] place-items-center rounded-[10px] bg-white/5 shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line2)]";

  return (
    <>
      {user ? (
        <button type="button" onClick={() => toggle(true)} aria-label={`Account: ${user.name}`} className={`${shell} w-[34px]`}>
          <Avatar user={user} size={24} />
        </button>
      ) : (
        <button type="button" {...hover} onClick={() => toggle(true)} aria-label="Sign in" disabled={loading} className={`${shell} w-9 text-fg2 hover:text-fg disabled:opacity-50 sm:flex sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[13px]`}>
          <UserIcon ref={ref} size={15} className="grid place-items-center" />
          <span className="hidden sm:inline">Sign in</span>
        </button>
      )}

      <Sheet open={open} onOpenChange={toggle} title={user ? user.name : "Sign in"}>
        {user ? (
          <ul className="grid gap-2">
            <Row href="/folders" icon={FoldersIcon} n={folders.length} onPick={() => setOpen(false)}>Folders</Row>
            <Row href="/browse?job=saved" icon={HeartIcon} n={saved.length} onPick={() => setOpen(false)}>Saved</Row>
            <li>
              <button type="button" onClick={() => (setOpen(false), signOut())} className="flex h-12 w-full items-center gap-[15px] rounded-2xl px-4 text-[17px] font-semibold text-fg2 transition-transform hover:text-fg active:scale-95">
                <LogOut size={20} aria-hidden />
                Sign out
              </button>
            </li>
          </ul>
        ) : (
          <div className="px-2 pb-1">
            <p className="text-[15px] text-fg2">Keep your saved libraries and folders on every device, and share a folder with a link.</p>
            <button
              type="button"
              disabled={going}
              onClick={() => (setGoing(true), haptic("light"), signIn().finally(() => setGoing(false)))}
              className="press mt-5 flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-fg text-[16px] font-semibold text-black hover:bg-white active:scale-[0.97] disabled:opacity-60"
            >
              <GithubMark size={18} />
              {going ? "Opening GitHub…" : "Continue with GitHub"}
            </button>
            <p className="mt-3 text-center text-[12.5px] text-fg3">We keep your GitHub name, avatar and email. Nothing else.</p>
          </div>
        )}
      </Sheet>
    </>
  );
}

function Row({ href, icon: Icon, n, onPick, children }: { href: string; icon: AnimatedIcon; n: number; onPick: () => void; children: ReactNode }) {
  const { ref, on } = useIconHover();
  return (
    <li>
      <a href={href} {...on} onClick={() => (haptic("selection"), onPick())} className="flex h-12 items-center gap-[15px] rounded-2xl bg-s3 px-4 text-[17px] font-semibold text-fg transition-transform active:scale-95">
        <Icon ref={ref} size={20} className="grid place-items-center" />
        <span className="flex-1">{children}</span>
        <span className="font-mono text-[13px] font-medium text-fg3 tabular-nums">{n}</span>
      </a>
    </li>
  );
}
