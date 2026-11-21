// Desktop navigation, a 56px icon rail. Hovering an item slides one highlight to it (Motion Primitives'
// AnimatedBackground) and plays its icon (lucide-animated); a single tooltip travels between items (transitions.dev's
// tooltip recipe, turned to run vertically). Hidden below lg, where TabBar takes over. Persists across navigations.
import { MotionConfig } from "motion/react";
import { useEffect, useRef } from "react";
import { isCurrent, sections, usePath, type AnimatedIcon, type IconHandle } from "../lib/nav.ts";
import { GithubIcon } from "./icons/github.tsx";
import { AnimatedBackground } from "./ui/animated-background.tsx";

const REPO = "https://github.com/EhsanulHaqueSiam/tastebase";
const items: { href: string; label: string; icon: AnimatedIcon; external?: boolean }[] = [...sections, { href: REPO, label: "GitHub", icon: GithubIcon, external: true }];

export default function Rail({ path: initial }: { path: string }) {
  const path = usePath(initial);
  const tip = useRef<HTMLSpanElement>(null);
  const icons = useRef(new Map<string, IconHandle>());

  // The header's "tastebase / Section" crumb persists too, so the rail keeps it in step.
  useEffect(() => {
    const crumb = document.querySelector("[data-crumb]");
    if (crumb) crumb.textContent = sections.find((s) => isCurrent(s.href, path))?.label ?? "";
  }, [path]);

  // From the recipe: snap the bubble under a new target while hidden so only the appear plays; tween while showing.
  const show = (label: string, target: HTMLElement) => {
    const t = tip.current!;
    const text = t.firstElementChild!;
    text.textContent = label;
    const width = `${Math.ceil(text.scrollWidth + 18)}px`;
    const y = `${target.offsetTop + target.offsetHeight / 2}px`;
    if (t.dataset.show !== "true") {
      t.style.transition = "none";
      Object.assign(t.style, { width });
      t.style.setProperty("--tt-y", y);
      void t.offsetWidth;
      t.style.transition = "";
    } else {
      t.style.width = width;
      t.style.setProperty("--tt-y", y);
    }
    t.dataset.show = "true";
  };
  const hide = () => tip.current && (tip.current.dataset.show = "false");

  return (
    <MotionConfig reducedMotion="user">
      <nav aria-label="Sections" className="fixed inset-y-0 left-0 z-40 hidden w-14 flex-col items-center gap-1 py-3 lg:flex" onPointerLeave={hide}>
        <a href="/" aria-label="tastebase home" className="group mb-3 grid size-9 place-items-center">
          <svg viewBox="0 0 100 100" className="size-5" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round"><path d="M44 18V64Q44 80 60 80H68" /><path d="M28 40H64" /></g>
            <circle cx="76" cy="24" r="7.5" className="origin-center fill-blue transition-transform duration-200 ease-[var(--ease-out)] [transform-box:fill-box] group-hover:scale-125" />
          </svg>
        </a>
        <AnimatedBackground enableHover className="rounded-[10px] bg-s2" transition={{ type: "spring", bounce: 0, duration: 0.25 }}>
          {items.map((it) => {
            const on = !it.external && isCurrent(it.href, path);
            return (
              <a
                key={it.href}
                data-id={it.href}
                href={it.href}
                aria-label={it.label}
                aria-current={on ? "page" : undefined}
                {...(it.external && { target: "_blank", rel: "noreferrer" })}
                onPointerEnter={(e) => (icons.current.get(it.href)?.startAnimation(), show(it.label, e.currentTarget))}
                onPointerLeave={() => icons.current.get(it.href)?.stopAnimation()}
                onFocus={(e) => show(it.label, e.currentTarget)}
                onBlur={hide}
                className={`press size-9 items-center justify-center rounded-[10px] transition-colors ${on ? "bg-s3 text-fg" : "text-fg2 hover:text-fg"} ${it.href === "/contribute" ? "mt-auto" : ""}`}
              >
                <it.icon ref={(h) => void (h ? icons.current.set(it.href, h) : icons.current.delete(it.href))} size={18} className="grid place-items-center" />
              </a>
            );
          })}
        </AnimatedBackground>
        <span ref={tip} className="t-tt" role="tooltip" aria-hidden="true" data-show="false">
          <span className="t-tt-text" />
        </span>
      </nav>
    </MotionConfig>
  );
}
