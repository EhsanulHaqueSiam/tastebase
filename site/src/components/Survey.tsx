// The taste survey, inside the account sheet (AccountButton.tsx loads it on open): six looks, then six libraries that
// follow the looks liked. Like or skip by dragging the card, the ✕ and ♥ buttons, or ← →. The result hearts the
// libraries liked through the saved store, so they reach an agent key like any other heart.
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { haptic } from "../lib/haptics.ts";
import { shot, thumb } from "../lib/kinds.ts";
import { saveAll, useAccount } from "../lib/saved.ts";
import { follow, SURVEY_KEY, type SurveyData, type SurveyLib, type SurveyLook } from "../lib/survey.ts";

const LIBS = 6;
let data: Promise<SurveyData> | undefined;
const load = () => (data ??= fetch("/survey.json").then((r) => (r.ok ? (r.json() as Promise<SurveyData>) : Promise.reject(new Error(`${r.status}`)))).catch((e: unknown) => ((data = undefined), Promise.reject(e))));

type Card = { look: SurveyLook } | { lib: SurveyLib };

export default function Survey({ onKey, onSignIn }: { onKey: () => void; onSignIn: () => void }) {
  const [d, setD] = useState<SurveyData>();
  const [failed, setFailed] = useState(false);
  const [i, setI] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [libIds, setLibIds] = useState<string[]>(); // chosen once the looks are done
  useEffect(() => void load().then(setD, () => setFailed(true)), []);

  const looks = d?.looks ?? [];
  const deck: Card[] = [...looks.map((look) => ({ look })), ...(libIds ?? []).flatMap((id) => d?.libs.filter((l) => l.id === id).map((lib) => ({ lib })) ?? [])];
  const total = looks.length + (libIds?.length ?? LIBS);
  const done = !!d && i >= total;

  useEffect(() => {
    if (!done) return;
    try {
      localStorage.setItem(SURVEY_KEY, "done");
    } catch {}
    document.getElementById("taste")?.remove(); // the home banner, if this page has it
  }, [done]);

  if (failed) return <p className="px-2 pb-2 text-[14px] text-fg2">Couldn't load the cards. Check your connection and open it again.</p>;
  if (!d) return <div className="h-[392px]" aria-busy="true" />;
  if (done) return <Result looks={looks.filter((l) => liked.includes(l.id))} libs={d.libs.filter((l) => liked.includes(l.id))} onAgain={() => (setI(0), setLiked([]), setLibIds(undefined))} onKey={onKey} onSignIn={onSignIn} />;

  const decide = (like: boolean) => {
    const card = deck[i];
    if (!card) return;
    haptic("selection");
    const now = like ? [...liked, "look" in card ? card.look.id : card.lib.id] : liked;
    setLiked(now);
    if (i + 1 === looks.length) setLibIds(follow(looks, now, LIBS));
    setI(i + 1);
  };
  return <Deck deck={deck} i={i} total={total} onDecide={decide} />;
}

/** The card stack, progress and buttons. Flings the top card off before reporting the decision. */
function Deck({ deck, i, total, onDecide }: { deck: Card[]; i: number; total: number; onDecide: (like: boolean) => void }) {
  const x = useMotionValue(0);
  const reduce = useReducedMotion();
  const busy = useRef(false);
  const back = useTransform(x, [-160, 0, 160], [1, 0.95, 1]);
  const backY = useTransform(back, [0.95, 1], [10, 0]);
  const backOpacity = useTransform(back, [0.95, 1], [0.5, 1]);
  const rotate = useTransform(x, [-220, 220], [-10, 10]);

  const go = async (like: boolean) => {
    if (busy.current || !deck[i]) return;
    busy.current = true;
    if (!reduce) await animate(x, like ? 440 : -440, { duration: 0.2, ease: [0.4, 0, 1, 1] });
    onDecide(like);
    x.jump(0);
    busy.current = false;
  };
  const latest = useRef(go);
  latest.current = go;
  useEffect(() => {
    const key = (e: KeyboardEvent) => (e.key === "ArrowRight" ? latest.current(true) : e.key === "ArrowLeft" ? latest.current(false) : undefined);
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);

  const top = deck[i];
  const next = deck[i + 1];
  return (
    <div className="px-1">
      <p className="px-1 text-[13px] text-fg2">Looks first, then libraries that fit them.</p>
      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-s3" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={i} aria-label="Cards done">
        <div className="h-full rounded-full bg-fg transition-[width] duration-200 ease-[var(--ease-out)]" style={{ width: `${(i / total) * 100}%` }} />
      </div>
      <div className="relative mt-4 h-[262px]" data-vaul-no-drag>
        {next && (
          <motion.div aria-hidden className="absolute inset-0" style={{ scale: back, y: backY, opacity: backOpacity }}>
            <Face card={next} />
          </motion.div>
        )}
        {top && (
          <motion.div
            key={i}
            className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
            style={{ x, rotate }}
            drag="x"
            dragMomentum={false}
            onDragEnd={(_, { offset, velocity }) => {
              if (Math.abs(offset.x) > 100 || Math.abs(velocity.x) > 600) void go(offset.x > 0);
              else void animate(x, 0, reduce ? { duration: 0 } : { type: "spring", duration: 0.3, bounce: 0.25 });
            }}
          >
            <Face card={top} />
            <Stamps x={x} />
          </motion.div>
        )}
      </div>
      <div className="mt-4 flex justify-center gap-4">
        <button type="button" onClick={() => void go(false)} aria-label="Skip" className="press grid size-[52px] place-items-center rounded-full bg-s3 text-[20px] text-fg2 shadow-[inset_0_0_0_1px_var(--color-line2)] hover:text-fg">✕</button>
        <button type="button" onClick={() => void go(true)} aria-label="Like" className="press grid size-[52px] place-items-center rounded-full bg-s3 text-[20px] text-pink shadow-[inset_0_0_0_1px_var(--color-line2)]">♥</button>
      </div>
      <p className="mt-2 text-center font-mono text-[11px] text-fg3">drag, tap, or ← →</p>
    </div>
  );
}

/** One card: a look drawn from its swatch, or a library's screenshot. */
function Face({ card }: { card: Card }) {
  const [name, line] = "look" in card ? [card.look.name, card.look.summary] : [card.lib.name, card.lib.tagline];
  return (
    <div className="relative size-full overflow-hidden rounded-2xl bg-s1 shadow-[0_0_0_1px_var(--color-line2),0_20px_40px_-20px_#000] select-none">
      <div className="h-[178px] overflow-hidden">
        {"look" in card ? <Specimen look={card.look} /> : <img src={thumb(shot(card.lib.id))} alt="" draggable={false} className="size-full object-cover object-top" />}
      </div>
      <div className="px-3.5 py-2.5">
        <p className="text-[15px] font-semibold">{name}</p>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-fg2">{line}</p>
      </div>
    </div>
  );
}

/** Like and Skip fade in over the top card as it is dragged toward either side. */
function Stamps({ x }: { x: MotionValue<number> }) {
  const like = useTransform(x, [24, 110], [0, 1]);
  const skip = useTransform(x, [-110, -24], [1, 0]);
  return (
    <>
      <motion.span style={{ opacity: like }} className="absolute top-3 left-3 rounded-lg bg-black/70 px-2 py-0.5 text-[13px] font-semibold text-pink">♥ Like</motion.span>
      <motion.span style={{ opacity: skip }} className="absolute top-3 right-3 rounded-lg bg-black/70 px-2 py-0.5 text-[13px] font-semibold text-white/80">Skip</motion.span>
    </>
  );
}

const FONTS: Record<SurveyLook["swatch"]["font"], CSSProperties> = {
  sans: { fontFamily: "var(--font-sans)", fontWeight: 600 },
  serif: { fontFamily: 'ui-serif, "Iowan Old Style", Palatino, Georgia, serif', fontWeight: 600 },
  mono: { fontFamily: "var(--font-mono)", fontWeight: 500 },
  display: { fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif', fontWeight: 900, letterSpacing: "-0.02em" },
  rounded: { fontFamily: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", var(--font-sans)', fontWeight: 700 },
  pixel: { fontFamily: "Silkscreen, var(--font-mono)" },
  hand: { fontFamily: 'Caveat, "Bradley Hand", cursive', fontWeight: 600 },
};

// A swatch's `card` declarations ("border:2px solid #000;box-shadow:...") as a React style.
const declarations = (css = ""): CSSProperties =>
  Object.fromEntries(css.split(";").filter((s) => s.includes(":")).map((s) => [s.slice(0, s.indexOf(":")).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), s.slice(s.indexOf(":") + 1).trim()]));

// Text on the accent: near-black on light accents, white on dark ones (the threshold /looks uses).
const ink = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.19 ? "#111" : "#fff";
};

/** A small screen in the look: its ground, a panel in its material and radius, its type and its accent. */
function Specimen({ look: { name, swatch: s } }: { look: SurveyLook }) {
  return (
    <div className="grid size-full place-items-center p-5" style={{ background: s.bg, color: s.text }}>
      <div className="w-full max-w-[250px] p-4" style={{ background: s.surface, borderRadius: s.radius, ...declarations(s.card) }}>
        <p className="text-[19px] leading-tight" style={FONTS[s.font]}>{name}</p>
        <div className="mt-2.5 grid gap-1.5">
          <i className="block h-1.5 w-[86%] rounded-full opacity-25" style={{ background: s.text }} />
          <i className="block h-1.5 w-[62%] rounded-full opacity-25" style={{ background: s.text }} />
        </div>
        <span className="mt-3.5 inline-block px-3 py-1 text-[11px] font-semibold" style={{ background: s.accent, color: ink(s.accent), borderRadius: s.radius }}>Get started</span>
      </div>
    </div>
  );
}

/** "Your taste": the looks liked, the libraries liked as chips, and Save to my hearts. */
function Result({ looks, libs, onAgain, onKey, onSignIn }: { looks: SurveyLook[]; libs: SurveyLib[]; onAgain: () => void; onKey: () => void; onSignIn: () => void }) {
  const { user } = useAccount();
  const [saved, setSaved] = useState(false);
  const save = () => (saveAll(libs.map((l) => l.id)), setSaved(true), haptic("success"), toast(`${libs.length} saved to your hearts`));
  return (
    <div className="px-1">
      <div className="rounded-2xl bg-s1 p-3.5 shadow-[inset_0_0_0_1px_var(--color-line2)]">
        <p className="text-[15px] font-semibold">{looks.length ? looks.map((l) => l.name).join(", ") : "No look stood out"}</p>
        <p className="mt-0.5 text-[13px] text-fg2">{libs.length ? `${libs.length} ${libs.length === 1 ? "library" : "libraries"} you liked` : "No libraries liked yet"}</p>
        {libs.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {libs.map((l) => (
              <li key={l.id} className="rounded-lg bg-s3 px-2 py-1 text-[12.5px]"><span className="text-pink">♥</span> {l.name}</li>
            ))}
          </ul>
        )}
      </div>
      {libs.length > 0 && (
        <button type="button" disabled={saved} onClick={save} className="press mt-3 h-11 w-full rounded-2xl bg-fg text-[15px] font-semibold text-bg disabled:opacity-60">
          {saved ? "Saved to your hearts" : "Save to my hearts"}
        </button>
      )}
      <p className="mt-3 px-2 text-center text-[13px] text-fg2">
        {user ? "Then make an agent key, and your agent picks with your taste. " : "Hearts stay in this browser. Sign in to keep them and give your agent your taste. "}
        <button type="button" onClick={user ? onKey : onSignIn} className="font-semibold text-fg underline-offset-2 hover:underline">{user ? "Agent key" : "Sign in"}</button>
      </p>
      <button type="button" onClick={onAgain} className="press mt-2 h-10 w-full rounded-2xl text-[14px] font-semibold text-fg2 hover:text-fg">Start over</button>
    </div>
  );
}
