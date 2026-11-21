// A segmented control for React islands: a .seg group that renders its own sliding pill (lib/seg.ts), so the pill is
// part of what React renders and hydration matches. Children are the aria-pressed buttons.
import { useEffect, useRef, type ReactNode } from "react";
import { trackSeg } from "../lib/seg.ts";

export function Seg({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  const seg = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  useEffect(() => trackSeg(seg.current!, pill.current!), []);
  return (
    <div ref={seg} className={`seg ${className}`} role="group" aria-label={label}>
      <span ref={pill} className="t-tabs-pill" aria-hidden="true" />
      {children}
    </div>
  );
}
