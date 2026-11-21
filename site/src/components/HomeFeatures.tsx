// Homepage, under the hero (after Design Index's): a two-tone tagline whose words rise in one by one, then a bento of
// what tastebase is: the mark, its categories, natural-language search, the hand-picked count and the articles. Cards
// rise in with a stagger when the grid scrolls into view; their inner graphics slide in after. Hover lifts a card 4px,
// or raises its graphic on the cards that have one. Everything plays once, and only on entry or hover.
import { ArrowLeft, ArrowRight, ChevronDown, RotateCw } from "lucide-react";
import { AnimatePresence, motion, MotionConfig, stagger, useInView, type Variants } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const ease = [0.23, 1, 0.32, 1] as const;
const QUERIES = ["toast that stacks and swipes away", "iOS-like bottom sheet", "dark dashboard with charts", "shader hero like Resend", "animated number for a price"];

type Props = { categories: number; libraries: number; articles: number; sample: { name: string; tagline: string } };

export default function HomeFeatures({ categories, libraries, articles, sample }: Props) {
  return (
    <MotionConfig reducedMotion="user">
      <section className="mx-auto w-full max-w-[1250px] px-4 pt-20 pb-16 md:px-8 md:pt-28">
        <h2 className="text-[24px] leading-[1.08] font-medium tracking-[-0.03em] sm:text-[30px] md:text-[36px]">
          <Words text="No feeds to chase and no trends to keep up with," />
          <Words text="just a calm place to pick the right library." className="text-fg3" delay={0.35} />
        </h2>
        <Bento>
          <Card cls="flex h-[180px] items-center justify-center md:h-[296px]">
            <motion.svg viewBox="0 0 100 100" className="size-[84px] md:size-[132px]" variants={{ hidden: { opacity: 0, scale: 0.5, rotate: -45 }, shown: { opacity: 1, scale: 1, rotate: 0, transition: { type: "spring", stiffness: 140, damping: 16, delay: 0.25 } } }} aria-label="tastebase">
              <g fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round"><path d="M44 18V64Q44 80 60 80H68" /><path d="M28 40H64" /></g>
              <circle cx="76" cy="24" r="7.5" className="fill-blue" />
            </motion.svg>
          </Card>
          <Card href="/tools" cls="flex h-[180px] items-end md:h-[296px]">
            <div className="relative z-10 p-4 md:p-8">
              <Title><span className="text-[32px] md:text-[48px]">{categories}</span><br />categories</Title>
              <p className="mt-2 text-[12px] font-medium text-fg2 md:text-[15px]">Browse by what you're making</p>
            </div>
            <Slide x className="absolute top-12 right-0 bottom-0 hidden w-[68%] rounded-tl-xl bg-s2 p-3.5 shadow-[inset_1px_1px_0_var(--color-line2)] sm:block">
              <Row className="flex items-center gap-3">
                <span className="grid size-[64px] shrink-0 place-items-center rounded-lg bg-s3"><ChevronDown size={26} /></span>
                <span className="flex h-[64px] flex-1 items-center gap-3 rounded-lg bg-s3 px-4 text-[20px] font-medium tracking-[-0.01em]">
                  <svg viewBox="0 0 100 100" className="size-9" aria-hidden><g fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round"><path d="M44 18V64Q44 80 60 80H68" /><path d="M28 40H64" /></g><circle cx="76" cy="24" r="7.5" className="fill-blue" /></svg>
                  tastebase
                </span>
              </Row>
              <Row className="mt-3 flex items-center gap-4 pl-3 text-fg">
                <ArrowLeft size={28} aria-hidden /><ArrowRight size={28} className="text-fg3" aria-hidden /><RotateCw size={26} aria-hidden />
                <span className="flex-1 rounded-lg bg-s3 px-6 py-4 text-[20px] text-fg3">tastebase/tools</span>
              </Row>
            </Slide>
          </Card>
        </Bento>
        <Bento second>
          <Card href="#ask" onClick={() => document.getElementById("ask")?.focus()} cls="col-span-2 flex h-[220px] flex-col justify-between p-6 md:col-span-1 md:h-[296px] md:p-8">
            <Title cls="text-[32px] md:text-[40px]">Search in<br />natural language</Title>
            <Slide x className="-mr-6 rounded-l-lg bg-s2 px-6 py-5 text-[17px] text-fg3 shadow-[inset_0_0_0_1px_var(--color-line2)] md:-mr-8"><Rotating items={QUERIES} /></Slide>
          </Card>
          <Card href="/browse" raise cls="flex h-[220px] flex-col justify-between pt-4 pl-4 md:h-[296px] md:pt-8 md:pl-8">
            <Title><span className="text-[32px] md:text-[48px]">{libraries}+</span><br />hand-picked<br />libraries</Title>
            <Slide className="flex items-center gap-3 rounded-tl-xl bg-s2 px-3 py-3 shadow-[inset_1px_1px_0_var(--color-line2)]">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-s3 text-[13px] font-semibold">{sample.name[0]}</span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[14px] font-medium">{sample.name}</span>
                <span className="block truncate text-[11px] text-fg2">{sample.tagline}</span>
              </span>
            </Slide>
          </Card>
          <Card href="/best" raise cls="flex h-[220px] flex-col justify-between pt-4 pl-4 md:h-[296px] md:pt-8 md:pl-8">
            <div>
              <Title>Our<br />writing</Title>
              <p className="mt-2 pr-3 text-[12px] leading-tight font-medium text-fg2 md:text-[15px]">{articles} roundups and honest alternatives</p>
            </div>
            <Slide className="h-[80px] rounded-t-xl bg-s2 p-4 shadow-[inset_0_1px_0_var(--color-line2),inset_1px_0_0_var(--color-line2)] md:h-[100px]">
              <Bar className="h-3 w-3/4 bg-s3" />
              <Bar className="mt-3 h-2 w-full bg-s3/60" />
              <Bar className="mt-2 h-2 w-2/3 bg-s3/60" />
            </Slide>
          </Card>
        </Bento>
      </section>
    </MotionConfig>
  );
}

/** Words that rise out of a blur one after another, once, when the line scrolls into view. */
function Words({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <motion.span className={`block ${className}`} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.6 }} transition={{ delayChildren: delay, staggerChildren: 0.05 }} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom" aria-hidden>
          <motion.span className="inline-block" variants={{ hidden: { opacity: 0, y: 20, filter: "blur(6px)" }, shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] } } }}>
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

const card: Variants = { hidden: { opacity: 0, y: 36, scale: 0.97 }, shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease } } };

function Bento({ second, children }: { second?: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.25 }}
      transition={{ delayChildren: stagger(0.09) }}
      className={`grid grid-cols-2 gap-3 md:gap-5 ${second ? "mt-3 md:mt-5 md:grid-cols-[1.9fr_1fr_1fr]" : "mt-8 md:mt-10 md:grid-cols-[1fr_3fr] lg:grid-cols-[296px_1fr]"}`}
    >
      {children}
    </motion.div>
  );
}

/** A bento card. `raise` lifts its graphic on hover instead of the whole card. */
function Card({ href, onClick, raise, cls, children }: { href?: string; onClick?: () => void; raise?: boolean; cls: string; children: ReactNode }) {
  const Tag = href ? motion.a : motion.div;
  return (
    <Tag
      href={href}
      onClick={onClick}
      variants={card}
      whileHover={raise ? "raised" : { y: -4, transition: { duration: 0.25, ease } }}
      className={`relative overflow-hidden rounded-xl bg-s1 shadow-[0_0_0_1px_var(--color-line)] ${cls}`}
    >
      {children}
    </Tag>
  );
}

const Title = ({ cls = "text-[22px] md:text-[34px]", children }: { cls?: string; children: ReactNode }) => <p className={`leading-[0.95] font-semibold tracking-[-0.03em] ${cls}`}>{children}</p>;

/** A card's graphic: slides in (x from the right, else up) after the card, and rises 12px when a `raise` card is hovered. */
function Slide({ x, className, children }: { x?: boolean; className: string; children: ReactNode }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, ...(x ? { x: 48 } : { y: 28 }) }, shown: { opacity: 1, x: 0, y: 0, transition: { duration: 0.7, ease, delay: 0.4 } }, raised: { y: -12, transition: { duration: 0.3, ease } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const Row = ({ className, children }: { className: string; children: ReactNode }) => (
  <motion.div variants={{ hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease, delay: 0.6 } } }} className={className}>{children}</motion.div>
);

const Bar = ({ className }: { className: string }) => (
  <motion.div variants={{ hidden: { opacity: 0, scaleX: 0 }, shown: { opacity: 1, scaleX: 1, transition: { duration: 0.6, ease, delay: 0.7 } } }} className={`origin-left rounded ${className}`} />
);

/** Example queries that swap every 3s, only while on screen. */
function Rotating({ items }: { items: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!visible || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 3000);
    return () => clearInterval(t);
  }, [visible, items.length]);
  return (
    <span ref={ref} className="relative block h-[1.4em] overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={i} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="block whitespace-nowrap">
          {items[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
