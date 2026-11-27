// Header account control. Signed out: "Sign in", which opens the sign-in dialog with a button for each provider this
// stage has keys for (GitHub, Google, X; also opened by askSignIn() when a signed-out visitor reaches for a folder).
// Signed in: the avatar, a link to /account, where everything the user controls lives. The taste survey (Survey.tsx,
// loaded on open) opens in a sheet, from the dialog, the home banner or the dashboard (a `tb:survey` event).
import { ChevronRight, Sparkles, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { haptic } from "../lib/haptics.ts";
import { useIconHover } from "../lib/nav.ts";
import { signIn, signInProviders, useAccount, type Provider } from "../lib/saved.ts";
import { Avatar, Sheet } from "./AccountSheet.tsx";
import { GithubMark } from "./GithubMark.tsx";
import { UserIcon } from "./icons/user.tsx";

const Survey = lazy(() => import("./Survey.tsx"));

export default function AccountButton() {
  const { user, loading } = useAccount();
  const [dialog, setDialog] = useState(false);
  const [survey, setSurvey] = useState(false);
  const { ref, on: hover } = useIconHover();
  useEffect(() => {
    const show = () => (survey ? signInAfterSurvey() : setDialog(true));
    const quiz = () => (setDialog(false), setSurvey(true));
    addEventListener("tb:signin", show);
    addEventListener("tb:survey", quiz);
    return () => (removeEventListener("tb:signin", show), removeEventListener("tb:survey", quiz));
  }, [survey]);

  // vaul blocks clicks on the page until its sheet has finished closing (0.5s), and tells nobody when a close it was
  // handed (open={false}) ends: open the dialog once the sheet is gone.
  const signInAfterSurvey = () => (setSurvey(false), setTimeout(() => setDialog(true), 520));
  const shell = "press grid h-[34px] place-items-center rounded-[10px] bg-white/5 shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line2)]";

  return (
    <>
      {user ? (
        <a href="/account" onClick={() => haptic("selection")} aria-label={`Account: ${user.name}`} className={`${shell} w-[34px]`}>
          <Avatar user={user} size={24} />
        </a>
      ) : (
        <button type="button" {...hover} onClick={() => (haptic("light"), setDialog(true))} aria-label="Sign in" disabled={loading} className={`${shell} w-9 text-fg2 hover:text-fg disabled:opacity-50 sm:flex sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[13px]`}>
          <UserIcon ref={ref} size={15} className="grid place-items-center" />
          <span className="hidden sm:inline">Sign in</span>
        </button>
      )}

      <SignInDialog open={dialog} onClose={() => setDialog(false)} onSurvey={() => (setDialog(false), setSurvey(true))} />

      <Sheet open={survey} onOpenChange={setSurvey} title="Find your taste">
        <Suspense fallback={<div className="h-[392px]" aria-busy="true" />}>
          <Survey onKey={() => (setSurvey(false), location.assign("/account#key"))} onSignIn={signInAfterSurvey} />
        </Suspense>
      </Sheet>
    </>
  );
}

/** Sign in, as a centered native <dialog>: the browser gives it focus, Escape and the top layer; this adds a click on the
 *  backdrop to close and puts focus back where it was. */
function SignInDialog({ open, onClose, onSurvey }: { open: boolean; onClose: () => void; onSurvey: () => void }) {
  const { user } = useAccount();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pressed = useRef(false); // a press that starts on the backdrop: only then does its click close the dialog
  const [going, setGoing] = useState<Provider>();
  const [offered, setOffered] = useState<Provider[]>();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) (opener.current = document.activeElement as HTMLElement | null), d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => void (open && !user && signInProviders().then(setOffered)), [open, user]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="signin-title"
      onClose={() => (onClose(), opener.current?.focus({ preventScroll: true }))}
      onPointerDown={(e) => (pressed.current = e.target === e.currentTarget)}
      onClick={(e) => e.target === e.currentTarget && pressed.current && ref.current?.close()}
      className="tb-dialog m-auto w-[min(380px,calc(100%-32px))] overflow-visible rounded-[20px] bg-s2 p-0 text-fg shadow-[0_0_0_1px_var(--color-line2),0_30px_80px_-20px_rgb(0_0_0/0.9)] backdrop:bg-black/60"
    >
      <div className="relative p-5">
        <p className="text-[13px] font-semibold text-fg3">tastebase</p>
        <h2 id="signin-title" className="mt-2 text-[19px] font-semibold tracking-[-0.02em]">{user ? user.name : "Sign in"}</h2>
        {user ? (
          <a href="/account" onClick={() => ref.current?.close()} className="press mt-5 flex h-11 items-center justify-center rounded-xl bg-fg text-[15px] font-semibold text-bg">Open your account</a>
        ) : (
          <>
            <p className="mt-1 pr-8 text-[13.5px] text-fg2">Your agent gets your look, hearts and dislikes in every project. Folders follow you to every device.</p>
            <div className="mt-5 grid min-h-11 gap-2">
              {offered?.map((p, i) => {
                const { name, Mark } = PROVIDERS[p];
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!!going}
                    onClick={() => (setGoing(p), haptic("light"), signIn(p).finally(() => setGoing(undefined)))}
                    className={`press flex h-11 w-full items-center justify-center gap-2.5 rounded-xl text-[15px] font-semibold active:scale-[0.98] disabled:opacity-60 ${i ? "bg-s3 text-fg shadow-[inset_0_0_0_1px_var(--color-line2)] hover:bg-line2" : "bg-fg text-bg hover:opacity-90"}`}
                  >
                    <Mark />
                    {going === p ? `Opening ${name}…` : `Continue with ${name}`}
                  </button>
                );
              })}
              {offered?.length === 0 && <p className="grid h-11 place-items-center rounded-xl bg-s3 text-[13.5px] text-fg2">Sign-in is not set up here.</p>}
            </div>
            <p className="mt-3 text-center text-[12px] text-fg3">We keep the name, avatar and email your provider shares. Nothing else.</p>
            <ul className="mt-4 border-t border-line pt-4">
              <ViewRow icon={<Sparkles size={18} aria-hidden />} value="30s" onPick={onSurvey}>Find your taste</ViewRow>
            </ul>
          </>
        )}
        {/* Last in order, so opening the dialog focuses its first provider rather than Close. */}
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="absolute top-4 right-4 grid size-8 place-items-center rounded-full bg-s3 text-fg2 transition-transform hover:text-fg active:scale-90">
          <X size={15} aria-hidden />
        </button>
      </div>
    </dialog>
  );
}

/** A row that opens another view: the taste survey. */
function ViewRow({ icon, value, onPick, children }: { icon: ReactNode; value: string; onPick: () => void; children: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={() => (haptic("selection"), onPick())} className="flex h-11 w-full items-center gap-3 rounded-xl bg-s3 px-3.5 text-left text-[15px] font-semibold text-fg transition-transform active:scale-[0.98]">
        {icon}
        <span className="flex-1">{children}</span>
        <span className="font-mono text-[13px] font-medium text-fg3 tabular-nums">{value}</span>
        <ChevronRight size={16} className="text-fg3" aria-hidden />
      </button>
    </li>
  );
}

/** How each provider is named and marked on its button. better-auth calls X "twitter". */
const PROVIDERS: Record<Provider, { name: string; Mark: () => ReactNode }> = {
  github: { name: "GitHub", Mark: () => <GithubMark size={18} /> },
  google: {
    name: "Google",
    Mark: () => (
      <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
      </svg>
    ),
  },
  twitter: {
    name: "X",
    Mark: () => (
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
        <path d="M18.9 1.2h3.7l-8 9.2L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.2H4.3l13.3 17.4Z" />
      </svg>
    ),
  },
};
