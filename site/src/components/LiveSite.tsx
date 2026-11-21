// A detail page's right panel: the real site in a browser window, laid out at the panel's width but never under 1024px
// (then scaled down to fit), so it reads as the desktop site at a legible size and stays fully usable (scroll, click,
// browse). Sites that refuse framing (checked by `pnpm capture`, site/src/lib/unframeable.json) or that never finish
// loading show their screenshot and a way out.
// A library with a hand-made demo (Demos.tsx) gets a second tab for it.
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { withUtm } from "../lib/utm.ts";
import { demos } from "./Demos.tsx";

const DESKTOP = 1024; // narrowest layout most sites still treat as desktop; wider panels lay out at their own width
const BLEED = 24; // extra width pushes the framed page's scrollbar past the clipped edge
const GIVE_UP_MS = 12_000;

type Props = { id: string; name: string; url: string; image: string; frameable: boolean };

export default function LiveSite({ id, name, url, image, frameable }: Props) {
  const Demo = demos[id];
  const [tab, setTab] = useState<"site" | "demo">("site");
  const host = url.replace(/^https?:\/\//, "");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-s1 shadow-[0_0_0_1px_var(--color-line2),0_30px_80px_-30px_rgb(0_0_0/0.9)]">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line bg-s2 px-3">
        <span className="flex gap-1.5" aria-hidden>
          <i className="size-2.5 rounded-full bg-[#ff5f57]" />
          <i className="size-2.5 rounded-full bg-[#febc2e]" />
          <i className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="ml-1 flex h-6 min-w-0 flex-1 items-center rounded-md bg-s1 px-2.5 font-mono text-[11px] text-fg3">
          <span className="truncate">{tab === "demo" ? `tastebase demo · ${name}` : `https://${host}`}</span>
        </span>
        {Demo && (
          <div className="seg" role="group" aria-label="View">
            <button type="button" aria-pressed={tab === "site"} onClick={() => setTab("site")}>Live site</button>
            <button type="button" aria-pressed={tab === "demo"} onClick={() => setTab("demo")}>Demo</button>
          </div>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        {tab === "demo" && Demo ? (
          <div className="dots grid size-full place-items-center overflow-auto p-6"><Demo /></div>
        ) : frameable ? (
          <Frame url={url} name={name} image={image} />
        ) : (
          <Fallback url={url} name={name} image={image} reason="This site doesn't allow being shown inside another page." />
        )}
      </div>
    </div>
  );
}

function Frame({ url, name, image }: { url: string; name: string; image: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const el = stage.current!;
    const ro = new ResizeObserver(([e]) => setBox({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    const t = setTimeout(() => setState((s) => (s === "loading" ? "failed" : s)), GIVE_UP_MS);
    return () => (ro.disconnect(), clearTimeout(t));
  }, []);

  if (state === "failed") return <Fallback url={url} name={name} image={image} reason="The site took too long to load here." />;
  const scale = box.w / Math.max(DESKTOP, box.w) || 1;
  return (
    <div ref={stage} className="absolute inset-0 overflow-hidden bg-bg">
      {box.w > 0 && (
        <iframe
          src={url}
          title={`${name} website`}
          onLoad={() => setState("ready")}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          className="origin-top-left border-0 bg-white"
          style={{ width: box.w / scale + BLEED, height: box.h / scale, transform: `scale(${scale})` }}
        />
      )}
      <div aria-hidden={state === "ready"} className={`absolute inset-0 grid place-items-center bg-s1 transition-opacity duration-300 ${state === "ready" ? "pointer-events-none opacity-0" : ""}`}>
        {state === "loading" && <span className="t-shimmer font-mono text-[11px] tracking-[0.12em] uppercase" data-text="Loading website">Loading website</span>}
      </div>
    </div>
  );
}

function Fallback({ url, name, image, reason }: { url: string; name: string; image: string; reason: string }) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-s1">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-s2/90 px-4 py-2.5 backdrop-blur-md">
        <p className="text-[13px] text-fg2">{reason} Here is how it looks.</p>
        <a href={withUtm(url, "detail-preview")} target="_blank" rel="noopener" className="press inline-flex h-8 items-center gap-1.5 rounded-lg bg-fg px-3 text-[13px] font-medium text-bg">
          Open in a new tab <ArrowUpRight size={14} aria-hidden />
        </a>
      </div>
      <img src={image} alt={`${name} website`} className="w-full" />
    </div>
  );
}
