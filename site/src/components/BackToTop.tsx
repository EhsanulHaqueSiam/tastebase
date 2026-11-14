import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

/** Round button that sharpens in once the page is scrolled past one screen. Pages without the dock get it. */
export default function BackToTop() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const check = () => setOn(scrollY > innerHeight);
    check();
    addEventListener("scroll", check, { passive: true });
    return () => removeEventListener("scroll", check);
  }, []);
  return (
    <button
      type="button"
      aria-label="Back to top"
      tabIndex={on ? 0 : -1}
      onClick={() => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      className={`fixed right-5 bottom-5 z-40 grid size-11 place-items-center rounded-full bg-fg text-black shadow-[0_16px_40px_-12px_rgb(0_0_0/0.9)] transition-[opacity,filter,visibility,transform] duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:bg-[#d9d9de] active:scale-[0.97] active:duration-150 ${on ? "visible opacity-100 blur-none" : "pointer-events-none invisible opacity-0 blur-[5px]"}`}
    >
      <ArrowUp size={18} />
    </button>
  );
}
