// Phone navigation: a bottom tab bar (the `tab` sections, Search, More). More opens a floating sheet, styled after
// Rare UI's family drawer, with every other section, so nothing the desktop rail reaches is out of reach on a phone.
// Icons play on tap and each tap gives a light haptic. Hidden from lg up, where the rail takes over.
import { MotionConfig } from "motion/react";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Drawer } from "vaul";
import { haptic } from "../lib/haptics.ts";
import { isCurrent, sections, useIconHover, usePath, type AnimatedIcon } from "../lib/nav.ts";
import { GithubIcon } from "./icons/github.tsx";
import { MenuIcon } from "./icons/menu.tsx";
import { SearchIcon } from "./icons/search.tsx";

const tabs = sections.filter((s) => s.tab);
const more = sections.filter((s) => !s.tab);

export default function TabBar() {
  const path = usePath();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const search = () => window.dispatchEvent(new CustomEvent("tb:search", { detail: "" }));

  return (
    <MotionConfig reducedMotion="user">
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-black/85 px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden">
        {tabs.map((s) => (
          <Tab key={s.href} href={s.href} icon={s.icon} on={isCurrent(s.href, path)}>{s.label}</Tab>
        ))}
        <Tab icon={SearchIcon} on={false} onTap={search}>Search</Tab>
        <Drawer.Root open={open} onOpenChange={(o) => (setOpen(o), o && haptic("light"))}>
          <Drawer.Trigger asChild>
            <Tab icon={MenuIcon} on={more.some((s) => isCurrent(s.href, path))}>More</Tab>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
            <Drawer.Content className="fixed inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 mx-auto max-w-[400px] rounded-[32px] bg-s2 px-4 pt-2 pb-4 shadow-[0_0_0_1px_var(--color-line2),0_30px_80px_-20px_rgb(0_0_0/0.9)] outline-none">
              <header className="mb-3 flex h-14 items-center justify-between border-b border-line pl-2">
                <Drawer.Title className="text-[17px] font-semibold">More</Drawer.Title>
                <Drawer.Close aria-label="Close" className="grid size-8 place-items-center rounded-full bg-s3 text-fg2 transition-transform active:scale-90">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </Drawer.Close>
              </header>
              <ul className="grid gap-2">
                {more.map((s) => (
                  <SheetRow key={s.href} href={s.href} icon={s.icon} on={isCurrent(s.href, path)} onPick={() => setOpen(false)}>{s.label}</SheetRow>
                ))}
                <SheetRow href="https://github.com/EhsanulHaqueSiam/tastebase" icon={GithubIcon} on={false} onPick={() => setOpen(false)}>GitHub</SheetRow>
              </ul>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </nav>
    </MotionConfig>
  );
}

/** One tab: a link when it has an href, else a button (Search, and More, which Drawer.Trigger asChild hands its props). */
function Tab({ href, icon: Icon, on, onTap, children, ...rest }: { href?: string; icon: AnimatedIcon; on: boolean; onTap?: () => void } & ComponentProps<"button">) {
  const { ref } = useIconHover();
  // Touch has no hover-out, so a tap plays the icon and then returns it (the menu icon would otherwise stay an X).
  const tap = () => (ref.current?.startAnimation(), setTimeout(() => ref.current?.stopAnimation(), 700), haptic("selection"), onTap?.());
  const cls = `press flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium ${on ? "text-fg" : "text-fg3"}`;
  const body = (
    <>
      <Icon ref={ref} size={20} className="grid place-items-center" />
      {children}
    </>
  );
  return href ? (
    <a href={href} aria-current={on ? "page" : undefined} onClick={tap} className={cls}>{body}</a>
  ) : (
    <button type="button" {...rest} onClick={(e) => (rest.onClick?.(e), tap())} className={cls}>{body}</button>
  );
}

function SheetRow({ href, icon: Icon, on, onPick, children }: { href: string; icon: AnimatedIcon; on: boolean; onPick: () => void; children: ReactNode }) {
  const { ref, on: hover } = useIconHover();
  return (
    <li>
      <a href={href} {...hover} onClick={() => (haptic("selection"), onPick())} aria-current={on ? "page" : undefined} className={`flex h-12 items-center gap-[15px] rounded-2xl px-4 text-[17px] font-semibold transition-transform active:scale-95 ${on ? "bg-fg text-black" : "bg-s3 text-fg"}`}>
        <Icon ref={ref} size={20} className="grid place-items-center" />
        {children}
      </a>
    </li>
  );
}
