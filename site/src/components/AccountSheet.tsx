// The floating sheet the folder picker and the taste survey open in: the More sheet's chrome from
// TabBar.tsx, on every screen size. vaul handles focus (with autoFocus: it is off by default), Escape, drag to dismiss and
// the scroll lock.
import { useRef, type ReactNode } from "react";
import { Drawer } from "vaul";
import type { User } from "../lib/saved.ts";

export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  // Radix returns focus to a Drawer.Trigger, and these open from state (a header button, a card's folder button): put
  // it back on whatever had it when the sheet opened.
  const opener = useRef<HTMLElement>(null);
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} autoFocus>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Drawer.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => (opener.current = document.activeElement as HTMLElement | null)}
          onCloseAutoFocus={(e) => (e.preventDefault(), opener.current?.focus({ preventScroll: true }))}
          className="fixed inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 mx-auto max-w-[400px] rounded-[32px] bg-s2 px-4 pt-2 pb-4 shadow-[0_0_0_1px_var(--color-line2),0_30px_80px_-20px_rgb(0_0_0/0.9)] outline-none"
        >
          <header className="mb-3 flex h-14 items-center justify-between border-b border-line pl-2">
            <Drawer.Title className="text-[17px] font-semibold">{title}</Drawer.Title>
            <Drawer.Close aria-label="Close" className="grid size-8 place-items-center rounded-full bg-s3 text-fg2 transition-transform active:scale-90">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </Drawer.Close>
          </header>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** The user's avatar from their sign-in provider, or their initial while it loads or when they have none. */
export function Avatar({ user, size }: { user: User; size: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-s3 text-[11px] font-semibold text-fg2 shadow-[inset_0_0_0_1px_var(--color-line2)]" style={{ width: size, height: size }}>
      {user.name.slice(0, 1).toUpperCase()}
      {user.image && <img src={user.image} alt="" className="absolute inset-0 size-full object-cover" />}
    </span>
  );
}
