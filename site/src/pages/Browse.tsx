import { Link, useParams } from "@tanstack/react-router";
import { ArrowUpRight, Check, Package, X } from "lucide-react";
import { GithubMark } from "../components/GithubMark.tsx";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { TextMorph } from "torph/react";
import { CopyButton } from "../components/fx.tsx";
import { demos } from "../components/Demos.tsx";
import { LibMark } from "../components/LibMark.tsx";
import { byId, isNew, kindMeta, libraries, shot, type Kind, type Library } from "../data.ts";

const TABS = ["usage", "prompt.md", "install"] as const;

export function Browse() {
  const { id } = useParams({ strict: false });
  const lib = (id && byId.get(id)) || libraries[0];
  const groups = useMemo(() => {
    const m = new Map<Kind, Library[]>();
    for (const l of libraries) m.set(l.kind, [...(m.get(l.kind) ?? []), l]);
    return [...m];
  }, []);
  if (!lib) return null;

  return (
    <div className="grid min-h-svh pt-14 lg:h-svh lg:grid-cols-[248px_1fr_360px]">
      <aside className="hidden overflow-y-auto border-r border-line px-2.5 py-4 lg:block">
        {groups.map(([k, libs]) => {
          const m = kindMeta[k];
          return (
            <div key={k} className="mb-4">
              <h4 className="flex items-center gap-2 px-2 py-1 text-[13px] font-semibold"><m.icon size={15} style={{ color: m.color }} />{m.label}</h4>
              {libs.map((l) => (
                <Link key={l.id} to="/browse/$id" params={{ id: l.id }} className="relative flex items-center justify-between rounded-lg py-1.5 pr-2 pl-8 text-[13.5px] text-fg2 transition-colors hover:text-fg">
                  {l.id === lib.id && <motion.span layoutId="side" className="absolute inset-0 rounded-lg bg-s2" transition={{ type: "spring", duration: 0.4, bounce: 0.12 }} />}
                  <span className={`relative ${l.id === lib.id ? "text-fg" : ""}`}>{l.name}</span>
                  {isNew(l) && <span className="relative rounded-full bg-green/12 px-1.5 text-[11px] font-medium text-green">New</span>}
                </Link>
              ))}
            </div>
          );
        })}
      </aside>

      <section className="flex min-w-0 flex-col border-r border-line">
        <Stage lib={lib} />
        <Code lib={lib} />
      </section>

      <Details lib={lib} />
    </div>
  );
}

function Stage({ lib }: { lib: Library }) {
  const Demo = demos[lib.id];
  const [view, setView] = useState<"demo" | "site">(Demo ? "demo" : "site");
  const v = Demo ? view : "site";
  return (
    <div className="relative flex min-h-[420px] flex-1 flex-col">
      <div className="flex h-11 items-center gap-1 border-b border-line px-3">
        {(["demo", "site"] as const).map((x) => (
          <button key={x} disabled={x === "demo" && !Demo} onClick={() => setView(x)} className="press relative h-7 rounded-md px-2.5 text-[12.5px] text-fg2 disabled:opacity-40">
            {v === x && <motion.span layoutId="view" className="absolute inset-0 rounded-md bg-s3" transition={{ type: "spring", duration: 0.35, bounce: 0.1 }} />}
            <span className="relative">{x === "demo" ? "Live demo" : "Website"}</span>
          </button>
        ))}
        <span className="flex-1" />
        <a href={lib.url} target="_blank" rel="noreferrer" className="press inline-flex items-center gap-1 text-[12.5px] text-fg2 hover:text-fg">Open site <ArrowUpRight size={13} /></a>
      </div>
      <div className="dots relative grid flex-1 place-items-center overflow-hidden p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${lib.id}-${v}`}
            className="grid size-full place-items-center"
            initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            {v === "demo" && Demo ? (
              <Demo />
            ) : (
              <img src={shot(lib.id)} alt={`${lib.name} website`} className="max-h-full w-full max-w-3xl rounded-xl object-cover object-top shadow-[0_0_0_1px_var(--color-line2),0_30px_80px_-30px_rgb(0_0_0/0.9)]" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Code({ lib }: { lib: Library }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("usage");
  const body = tab === "usage" ? lib.usage : tab === "install" ? lib.install : promptMd(lib);
  return (
    <div className="h-[260px] shrink-0 border-t border-line bg-s1">
      <div className="flex h-10 items-center gap-1 border-b border-line px-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="press relative h-7 rounded-md px-2.5 font-mono text-[12px] text-fg2">
            {tab === t && <motion.span layoutId="codetab" className="absolute inset-0 rounded-md bg-s3" transition={{ type: "spring", duration: 0.35, bounce: 0.1 }} />}
            <span className={`relative ${tab === t ? "text-fg" : ""}`}>{t}</span>
          </button>
        ))}
        <span className="flex-1" />
        <CopyButton value={body} quiet />
      </div>
      <AnimatePresence mode="wait">
        <motion.pre key={`${lib.id}-${tab}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="h-[218px] overflow-auto p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-fg/85">
          {body}
        </motion.pre>
      </AnimatePresence>
    </div>
  );
}

const promptMd = (l: Library) =>
  `# ${l.name}\n${l.note}\n\nUse for:\n${l.useFor.map((u) => `- ${u}`).join("\n")}\n\nAvoid when:\n${l.avoidWhen.map((u) => `- ${u}`).join("\n")}\n\nInstall: ${l.install}`;

function Details({ lib }: { lib: Library }) {
  const facts: [string, string][] = [
    ["Frameworks", lib.frameworks.join(", ")],
    ["Styling", lib.styling],
    ["Weight", lib.weight],
    ["Accessibility", lib.a11y],
    ["Maturity", lib.maturity],
    ["License", lib.license],
  ];
  return (
    <aside className="overflow-y-auto px-5 py-5">
      <div className="flex items-center gap-3">
        <LibMark lib={lib} size={42} />
        <div className="min-w-0">
          <TextMorph as="h1" className="text-lg font-semibold tracking-[-0.02em]">{lib.name}</TextMorph>
          <div className="text-[13px] text-fg2">by {lib.author}</div>
        </div>
      </div>
      <p className="mt-3 text-fg2">{lib.tagline}</p>
      <div className="mt-3 flex gap-3 text-[13px] text-fg2">
        {lib.repo && <a href={lib.repo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg"><GithubMark size={13} /> GitHub</a>}
        {lib.npm && <a href={`https://npmjs.com/package/${lib.npm}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg"><Package size={13} /> npm</a>}
      </div>

      <h5 className="mt-6 mb-2 text-[13px] font-semibold">Install</h5>
      <div className="flex items-center gap-2 rounded-xl bg-s1 py-1 pr-1 pl-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
        <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg/90">{lib.install}</code>
        <CopyButton value={lib.install} />
      </div>

      <Section title="Use it for" items={lib.useFor} icon={<Check size={14} className="mt-[3px] shrink-0 text-green" />} />
      <Section title="Skip it when" items={lib.avoidWhen} icon={<X size={14} className="mt-[3px] shrink-0 text-amber" />} />

      <h5 className="mt-6 mb-2 text-[13px] font-semibold">Facts</h5>
      <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
        {facts.flatMap(([k, v]) => [<dt key={`${k}t`} className="text-fg3">{k}</dt>, <dd key={`${k}d`} className="capitalize">{v}</dd>])}
      </dl>

      {[["Pairs with", lib.pairsWith], ["Alternatives", lib.alternatives]].map(([title, ids]) => {
        const list = ((ids as string[] | undefined) ?? []).map((i) => byId.get(i)).filter((x): x is Library => !!x);
        if (!list.length) return null;
        return (
          <div key={title as string}>
            <h5 className="mt-6 mb-2 text-[13px] font-semibold">{title as string}</h5>
            <div className="flex flex-wrap gap-1.5">
              {list.map((l) => (
                <Link key={l.id} to="/browse/$id" params={{ id: l.id }} className="press inline-flex items-center gap-2 rounded-lg bg-s2 py-1 pr-2.5 pl-1 text-[13px] hover:bg-s3"><LibMark lib={l} size={22} />{l.name}</Link>
              ))}
            </div>
          </div>
        );
      })}
    </aside>
  );
}

function Section({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  return (
    <>
      <h5 className="mt-6 mb-2 text-[13px] font-semibold">{title}</h5>
      <ul className="grid gap-1.5">
        {items.map((u, i) => (
          <motion.li key={u} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-2 text-[13px] text-fg2">{icon}{u}</motion.li>
        ))}
      </ul>
    </>
  );
}
