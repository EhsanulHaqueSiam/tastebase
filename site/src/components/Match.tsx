// /match: drop, paste or pick a screenshot; get the closest look and a library for each part it shows. The image is
// shrunk in the browser (1024px JPEG) and sent to /api/match, which describes it with a vision model and plans from that.
import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { haptic } from "../lib/haptics.ts";
import { kindMeta } from "../lib/kinds.ts";
import type { PlanJson } from "../lib/server.ts";
import { CopyButton } from "./fx.tsx";

type State = { step: "idle" } | { step: "reading"; preview: string } | { step: "done"; preview: string; description: string; plan: PlanJson } | { step: "error"; preview?: string; message: string };

/** Draws the image at most 1024px wide and returns a JPEG data URL: small enough to send, plenty for reading a style. */
async function shrink(file: Blob): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / img.width);
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function Match() {
  const [s, setS] = useState<State>({ step: "idle" });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = async (file: Blob | undefined | null) => {
    if (!file?.type.startsWith("image/")) return setS({ step: "error", message: "That is not an image. Drop a PNG, JPEG or WebP screenshot." });
    const preview = await shrink(file).catch(() => "");
    if (!preview) return setS({ step: "error", message: "This browser could not read that image. Try a PNG or JPEG." });
    setS({ step: "reading", preview });
    const r = await fetch("/api/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: preview }) }).catch(() => null);
    const data = (await r?.json().catch(() => null)) as { description?: string; plan?: PlanJson; error?: string } | null;
    if (!r?.ok || !data?.plan || !data.description) return setS({ step: "error", preview, message: data?.error ?? "Could not reach the matcher. Try again in a moment." });
    haptic("success");
    setS({ step: "done", preview, description: data.description, plan: data.plan });
  };

  // Paste a screenshot anywhere on the page (⌘V after a screen capture).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) e.preventDefault(), void run(file);
    };
    addEventListener("paste", onPaste);
    return () => removeEventListener("paste", onPaste);
  }, []);

  const preview = s.step === "idle" ? undefined : s.preview;
  return (
    <section className="mx-auto max-w-5xl px-4 pt-24 pb-24">
      <h1 className="text-[clamp(28px,3.6vw,40px)] leading-tight font-semibold tracking-[-0.035em]">Match a screenshot</h1>
      <p className="mt-2 max-w-xl text-fg2">Show us a UI you like. We read its look and tell you which libraries build it, one for each part we can see.</p>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => (e.preventDefault(), setOver(false), void run(e.dataTransfer.files[0]))}
          className={`press relative grid min-h-[260px] place-items-center overflow-hidden rounded-2xl bg-s1 text-center transition-shadow ${over ? "shadow-[inset_0_0_0_2px_var(--color-blue)]" : "shadow-[inset_0_0_0_1px_var(--color-line2)] hover:shadow-[inset_0_0_0_1px_var(--color-fg3)]"}`}
        >
          {preview ? (
            <img src={preview} alt="Your screenshot" className="absolute inset-0 size-full object-contain p-3" />
          ) : (
            <span className="flex flex-col items-center gap-3 px-6 text-fg2">
              <ImagePlus size={26} className="text-fg3" aria-hidden />
              <span><b className="font-medium text-fg">Drop a screenshot</b>, paste it with ⌘V, or tap to choose one</span>
              <span className="text-[12.5px] text-fg3">PNG, JPEG or WebP. It is only used to read the style.</span>
            </span>
          )}
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void run(e.target.files?.[0])} />
        </button>

        <div aria-live="polite" className="min-w-0">
          {s.step === "idle" && <p className="rounded-2xl p-5 text-fg3 shadow-[inset_0_0_0_1px_var(--color-line)]">The closest look and its libraries show up here.</p>}
          {s.step === "reading" && <p className="rounded-2xl p-5 shadow-[inset_0_0_0_1px_var(--color-line)]"><span className="t-shimmer" data-text="Reading the style of your screenshot…">Reading the style of your screenshot…</span></p>}
          {s.step === "error" && <p className="rounded-2xl p-5 text-amber shadow-[inset_0_0_0_1px_var(--color-line)]">{s.message}</p>}
          {s.step === "done" && <Result description={s.description} plan={s.plan} />}
        </div>
      </div>
    </section>
  );
}

function Result({ description, plan }: { description: string; plan: PlanJson }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="rounded-2xl bg-s1 p-5 shadow-[inset_0_0_0_1px_var(--color-line)]">
        <p className="text-[13px] text-fg3">Closest look</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-[-0.03em]">{plan.look.name}</p>
        <p className="mt-1 text-fg2">{plan.look.summary}</p>
        <details className="mt-3 text-[13px] text-fg2">
          <summary className="cursor-pointer text-fg3 hover:text-fg">What we saw</summary>
          <p className="mt-2">{description}</p>
        </details>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {plan.items.map(({ kind, pick }) => {
          if (!pick) return null;
          const m = kindMeta[kind];
          return (
            <li key={kind} className="flex items-center gap-3 rounded-xl bg-s1 p-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-s3" style={{ color: m.color }}><m.icon size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2"><span className="text-[12px] text-fg3">{m.label}</span><a href={`/browse/${pick.lib.id}`} className="font-medium hover:underline">{pick.lib.name}</a></span>
                <span className="block truncate text-[13px] text-fg2">{pick.why}</span>
              </span>
              <CopyButton value={pick.lib.install} label="Install" quiet />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
