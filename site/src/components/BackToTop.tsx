import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { useIconHover } from "../lib/nav.ts";
import { ArrowUpIcon } from "./icons/arrow-up.tsx";

/** Round button that sharpens in once the page is scrolled past one screen; its arrow plays on hover. On phones it sits above the tab bar. */
export default function BackToTop() {
  const [on, setOn] = useState(false);
  const { ref, on: hover } = useIconHover();
  useEffect(() => {
    const check = () => setOn(scrollY > innerHeight);
    check();
    addEventListener("scroll", check, { passive: true });
    return () => removeEventListener("scroll", check);
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <button
        type="button"
        aria-label="Back to top"
        tabIndex={on ? 0 : -1}
        {...hover}
        onClick={() => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
        className={`fixed right-5 bottom-5 z-40 grid size-11 place-items-center rounded-full bg-fg text-bg shadow-[0_16px_40px_-12px_rgb(0_0_0/0.9)] transition-[opacity,filter,visibility,transform] duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:opacity-85 active:scale-[0.97] active:duration-150 max-lg:bottom-[calc(72px+env(safe-area-inset-bottom))] ${on ? "visible opacity-100 blur-none" : "pointer-events-none invisible opacity-0 blur-[5px]"}`}
      >
        <ArrowUpIcon ref={ref} size={18} className="grid place-items-center" />
      </button>
    </MotionConfig>
  );
}
