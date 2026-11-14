// Shared motion pieces. Each one animates only in response to something (visibility, hover, a state change).
import { MeshGradient } from "@paper-design/shaders-react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { useRef, useState, type ComponentProps, type PointerEvent, type ReactNode } from "react";
import { TextMorph } from "torph/react";
import { toast } from "sonner";

/** Mesh gradient. Paper Shaders already pauses offscreen; we also stop it under reduced motion, which it ignores. */
export function ShaderBg({ colors, className, speed = 0.25 }: { colors: string[]; className?: string; speed?: number }) {
  const reduce = useReducedMotion();
  return (
    <div className={className} aria-hidden>
      <MeshGradient colors={colors} distortion={0.8} swirl={0.35} grainOverlay={0.12} speed={reduce ? 0 : speed} maxPixelCount={1920 * 1080} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

/** Crossfades between icons with blur and a small spring scale, so a state change reads as one object changing. */
export function IconMorph({ k, children }: { k: string; children: ReactNode }) {
  return (
    <span className="relative inline-grid size-4 place-items-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={k}
          className="col-start-1 row-start-1 grid place-items-center"
          initial={{ opacity: 0, scale: 0.5, filter: "blur(4px)", rotate: -30 }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)", rotate: 0 }}
          exit={{ opacity: 0, scale: 0.5, filter: "blur(4px)", rotate: 30 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.25 }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Copy to clipboard: icon morphs copy to check, label morphs letter by letter, a toast confirms. */
export function CopyButton({ value, label = "Copy", className = "", quiet }: { value: string; label?: string; className?: string; quiet?: boolean }) {
  const [done, setDone] = useState(false);
  const t = useRef<number>(undefined);
  const onClick = async () => {
    await navigator.clipboard?.writeText(value).catch(() => {});
    setDone(true);
    if (!quiet) toast("Copied", { description: value });
    clearTimeout(t.current);
    t.current = window.setTimeout(() => setDone(false), 1600);
  };
  return (
    <button
      onClick={onClick}
      className={`press inline-flex h-8 items-center gap-1.5 rounded-lg bg-s3 px-2.5 text-[12.5px] font-medium text-fg2 hover:bg-fg hover:text-black ${className}`}
    >
      <IconMorph k={done ? "y" : "n"}>{done ? <Check size={14} /> : <Copy size={14} />}</IconMorph>
      <TextMorph>{done ? "Copied" : label}</TextMorph>
    </button>
  );
}

/** Element drifts toward the pointer on a spring while hovered. Decorative only; disabled under reduced motion. */
export function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.5 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.5 });
  const move = (e: PointerEvent<HTMLSpanElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * strength);
    y.set((e.clientY - r.top - r.height / 2) * strength);
  };
  return (
    <motion.span style={{ x, y }} className="inline-block" onPointerMove={move} onPointerLeave={() => (x.set(0), y.set(0))}>
      {children}
    </motion.span>
  );
}

/** Card with a pointer-following spotlight (.spot in styles.css). */
export function SpotCard({ className = "", children, ...rest }: ComponentProps<"div">) {
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
  };
  return (
    <div onPointerMove={move} className={`spot ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Children rise and fade in once, staggered, when scrolled into view. */
export function Rise({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Pill link whose arrow swaps on hover (.cta in styles.css). `solid` is white on black; otherwise a dark fill. */
export function ArrowLink({ solid, className = "", children, ...rest }: { solid?: boolean } & ComponentProps<"a">) {
  const fill = solid ? "text-black [--cta-bg:var(--color-fg)] [--cta-hover:#d9d9de]" : "text-fg [--cta-bg:var(--color-s3)] [--cta-hover:#26262c]";
  return (
    <a className={`cta ${fill} ${className}`} {...rest}>
      <i aria-hidden />
      <ArrowRight size={16} aria-hidden />
      <span>{children}</span>
      <ArrowRight size={16} aria-hidden />
    </a>
  );
}
