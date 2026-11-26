// /account: the signed-in dashboard, one panel per job (picked by the URL hash): connect an agent, the look and framework
// it uses when a brief names none (with a preview of its plan), dislikes, hearts, folders, requests to list a site, and
// the user's data. Reads the account store (lib/saved.ts); the page itself is static.
import { ArrowUpRight, Check, Download, FolderPlus, Globe, Link2, Plus, Search } from "lucide-react";
import { navigate } from "astro:transitions/client";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { frameworks, type Framework, type Swatch } from "../../../src/registry/schema.ts";
import { haptic } from "../lib/haptics.ts";
import { shot, thumb } from "../lib/kinds.ts";
import { askSignIn, createFolder, deleteAccount, loadRequests, makeAgentKey, refreshAccount, revokeAgentKey, sendRequest, setPrefs, settleRequest, signOut, tasteSaved, toggleHidden, toggleOffLook, toggleSaved, updateFolder, useAccount, type AgentKey, type SiteRequest } from "../lib/saved.ts";
import { declarations, FONTS } from "../lib/swatch.ts";
import { Avatar } from "./AccountSheet.tsx";
import { FolderControls } from "./FolderControls.tsx";
import { CopyButton } from "./fx.tsx";
import { Seg } from "./Seg.tsx";

/** One look as the picker draws it; `family` is its family's name, or its own for a family. */
export type LookOption = { id: string; name: string; family: string; swatch: Swatch };
/** A library by id: its name and kind label, for the hearts list. */
export type LibName = { name: string; kind: string };

// One panel per job, picked by the URL hash so links, back and refresh keep it. Old hashes stay as aliases forever: the
// published CLI prints /account#key.
const PANELS = [
  ["connect", "Connect"],
  ["look", "Look"],
  ["dislikes", "Dislikes"],
  ["hearts", "Hearts"],
  ["folders", "Folders"],
  ["requests", "Requests"],
  ["data", "Data"],
] as const;
type Panel = (typeof PANELS)[number][0];
const ALIAS = new Map<string, Panel>([["key", "connect"], ["hidden", "dislikes"], ["off-look", "dislikes"], ["try", "look"]]);
const panelOf = (hash: string) => {
  const h = hash.slice(1);
  return PANELS.find(([id]) => id === h)?.[0] ?? ALIAS.get(h);
};

/** The hash that picked the open panel (#off-look opens Dislikes on its second tab). Astro's router owns history: it
 *  handles every same-page hash link itself (pushState, no hashchange) and walks back through them without a reload, as
 *  long as its own navigate() made the entries. So the dashboard only listens: a click on a link to one of its panels
 *  (the sidebar, the rail's Folders, a panel's own link), back and forward, and a hash set from outside. */
function usePanel() {
  const [hash, setHash] = useState(() => (panelOf(location.hash) ? location.hash : "#connect"));
  useEffect(() => {
    if (!panelOf(location.hash)) void navigate("#connect", { history: "replace" });
    const show = (h: string) => panelOf(h) && (setHash(h), scrollTo({ top: 0 }));
    const fromUrl = () => show(location.hash);
    const onClick = (e: globalThis.MouseEvent) => {
      const a = e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ? null : (e.target as Element).closest?.("a[href]");
      // Only this page's own links: a request's link to some other site's /account#data opens in a new tab and stays there.
      const to = a instanceof HTMLAnchorElement && !a.target ? new URL(a.href) : undefined;
      if (to?.origin === location.origin && to.pathname === location.pathname && panelOf(to.hash)) haptic("selection"), show(to.hash);
    };
    addEventListener("hashchange", fromUrl);
    addEventListener("popstate", fromUrl);
    document.addEventListener("click", onClick);
    return () => (removeEventListener("hashchange", fromUrl), removeEventListener("popstate", fromUrl), document.removeEventListener("click", onClick));
  }, []);
  return [panelOf(hash) ?? "connect", hash] as const;
}

const FRAMEWORK_NAMES: Record<Framework, string> = { react: "React", vue: "Vue", svelte: "Svelte", solid: "Solid", angular: "Angular", vanilla: "Vanilla JS", "react-native": "React Native" };
// None names a look, so the saved one shows; a look the brief names would win over it.
const BRIEFS = ["pricing page with a signup form", "habit tracker with charts and a bottom sheet", "settings page with a data table"];

export default function Account({ looks, libs, hrefs }: { looks: LookOption[]; libs: Record<string, LibName>; hrefs: Record<string, string> }) {
  const a = useAccount();
  const [panel, hash] = usePanel();
  const tab = useRef<HTMLAnchorElement>(null);
  // The agent's taste tool may have changed the account since the store loaded on another page.
  useEffect(() => void refreshAccount(), []);
  // On a phone the panels are a scrolling row: keep the open one in view.
  useEffect(() => void tab.current?.scrollIntoView({ block: "nearest", inline: "nearest" }), [panel, a.user]);

  if (!a.user)
    return (
      <Shell>
        {!a.loading && (
          <div className="mt-16 grid justify-items-center text-center">
            <p className="max-w-[360px] text-fg2">Sign in to connect your agent, set your look, keep folders and choose what it never recommends.</p>
            <button type="button" onClick={askSignIn} className="press mt-5 h-10 rounded-xl bg-fg px-4 text-[14px] font-semibold text-bg active:scale-95">Sign in</button>
          </div>
        )}
      </Shell>
    );

  const lookById = new Map(looks.map((l) => [l.id, l]));
  const counts: Partial<Record<Panel, number | string>> = {
    connect: a.keys.length,
    look: (a.look && lookById.get(a.look)?.name) || undefined,
    dislikes: a.hidden.length + a.offLook.length,
    hearts: a.saved.length,
    folders: a.folders.length,
  };

  return (
    <Shell>
      <div className="mt-5 grid gap-x-10 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Account" className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:sticky lg:top-[76px] lg:mx-0 lg:mb-0 lg:grid lg:content-start lg:gap-0.5 lg:self-start lg:px-0">
          <div className="hidden items-center gap-2.5 px-2.5 pb-4 lg:flex">
            <Avatar user={a.user} size={32} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{a.user.name}</p>
              <button type="button" onClick={() => signOut()} className="text-[12.5px] text-fg3 hover:text-fg">Sign out</button>
            </div>
          </div>
          {PANELS.map(([id, label]) => (
            <a
              key={id}
              ref={id === panel ? tab : undefined}
              href={`#${id}`}
              aria-current={id === panel ? "page" : undefined}
              className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] ${id === "data" ? "lg:mt-2 lg:border-t lg:border-line lg:rounded-t-none lg:pt-2.5" : ""} ${id === panel ? "bg-s2 text-fg shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-fg2 hover:bg-s2 hover:text-fg"}`}
            >
              {label}
              {counts[id] !== undefined && <span className="max-w-[90px] truncate font-mono text-[11px] text-fg3 tabular-nums max-lg:hidden">{counts[id]}</span>}
            </a>
          ))}
        </nav>

        <div className="min-w-0 max-w-[820px]">
          {panel === "connect" && (
            <Panel title="Connect your agent" lead="Signed in, your agent follows your look and dislikes in every project. Without it, your agent gets the same answers as everyone.">
              <KeyPanel keys={a.keys} />
            </Panel>
          )}

          {panel === "look" && (
            <Panel title="Look" lead="When a brief names no look, your agent builds in this one instead of Minimal. A look the brief names still wins.">
              <LookPicker looks={looks} value={a.look} />
              <h3 className="mt-6 text-[13px] font-semibold">Framework</h3>
              <p className="mt-0.5 text-[13px] text-fg2">Used when the brief and the project name none.</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {[null, ...frameworks].map((f) => (
                  <button key={f ?? "detect"} type="button" aria-pressed={a.framework === f} onClick={() => (haptic("selection"), setPrefs({ framework: f }))} className={chip(a.framework === f)}>
                    {f ? FRAMEWORK_NAMES[f] : "Detect"}
                  </button>
                ))}
              </div>
              <h3 className="mt-8 text-[13px] font-semibold">Try your agent</h3>
              <p className="mt-0.5 mb-3 text-[13px] text-fg2">Type a brief and read the plan your agent gets: the same text, with your look, hearts and dislikes applied.</p>
              <TryBrief />
            </Panel>
          )}

          {panel === "dislikes" && <Dislikes key={hash} libs={libs} lookName={(id) => lookById.get(id)?.name ?? id} />}

          {panel === "hearts" && (
            <Panel title="Hearts" lead="A hearted library wins a close call in your agent's picks. It never beats a clearly better fit.">
              <Rows empty="Nothing hearted yet. Use the heart on any library.">
                {a.saved.map((id) => (
                  <Row key={id} thumb={id} title={libs[id]?.name ?? id} sub={libs[id]?.kind} href={`/browse/${id}`}>
                    <Undo onClick={() => toggleSaved(id)}>Remove</Undo>
                  </Row>
                ))}
              </Rows>
              {a.saved.length > 0 && (
                <p className="mt-3 text-[13px] text-fg2">
                  <a href="#folders" className="font-medium text-fg underline decoration-fg3 underline-offset-4 hover:decoration-fg">Group them in folders</a>
                </p>
              )}
            </Panel>
          )}

          {panel === "folders" && <Folders libs={libs} />}

          {panel === "requests" && <Requests hrefs={hrefs} admin={a.admin} />}

          {panel === "data" && (
            <Panel title="Your data">
              <Rows>
                <Row title="Download everything" sub="Hearts, folders, look, framework, dislikes and requests, as JSON">
                  <button type="button" onClick={() => void download(a)} className={btn}><Download size={14} aria-hidden /> Download</button>
                </Row>
                <Row title="Retake the taste cards" sub="Six looks, then libraries that fit the ones you like">
                  <button type="button" onClick={() => dispatchEvent(new Event("tb:survey"))} className={btn}>Start</button>
                </Row>
                <Row title="Sign out" sub="On this device. Your agents stay signed in.">
                  <button type="button" onClick={() => signOut()} className={btn}>Sign out</button>
                </Row>
                <Row title="Delete account" sub="Removes your account, agent keys, folders, requests and everything above. Shared folder links stop working.">
                  <DeleteAccount />
                </Row>
              </Rows>
            </Panel>
          )}
        </div>
      </div>
    </Shell>
  );
}

const btn = "press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-s3 px-3 text-[13px] font-semibold shadow-[inset_0_0_0_1px_var(--color-line2)] disabled:opacity-50";
const chip = (on: boolean) => `press rounded-lg px-2.5 py-1 text-[13px] font-medium ${on ? "bg-fg text-bg" : "bg-s2 text-fg2 shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-fg"}`;

function Shell({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="account-title" className="mx-auto max-w-[1120px] px-4 pt-[76px] pb-24 lg:px-6">
      <h1 id="account-title" className="text-[18px] font-semibold tracking-[-0.02em]">Account</h1>
      {children}
    </section>
  );
}

function Rows({ empty, children }: { empty?: string; children: ReactNode[] | ReactNode }) {
  const none = Array.isArray(children) && children.length === 0;
  if (none) return <p className="rounded-xl bg-s1 px-3.5 py-3 text-[13px] text-fg2 shadow-[inset_0_0_0_1px_var(--color-line)]">{empty}</p>;
  return <ul className="divide-y divide-line rounded-xl shadow-[inset_0_0_0_1px_var(--color-line2)]">{children}</ul>;
}

function Row({ title, sub, href, thumb: id, children }: { title: string; sub?: string; href?: string; thumb?: string; children: ReactNode }) {
  return (
    <li className="flex min-h-12 items-center gap-3 px-3.5 py-2">
      {id && <img src={thumb(shot(id))} alt="" loading="lazy" className="h-[30px] w-11 shrink-0 rounded-md bg-s3 object-cover object-top" />}
      <div className="min-w-0 flex-1">
        {href ? <a href={href} className="block truncate text-[14px] font-medium hover:underline">{title}</a> : <p className="truncate text-[14px] font-medium">{title}</p>}
        {sub && <p className="truncate text-[12.5px] text-fg3">{sub}</p>}
      </div>
      {children}
    </li>
  );
}

function Undo({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={() => (haptic("selection"), onClick())} className="press shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-fg2 hover:text-fg">{children}</button>;
}

/** The look picker: the chosen look large, then every look as a small specimen, searchable, grouped by family. */
function LookPicker({ looks, value }: { looks: LookOption[]; value: string | null }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(!value);
  const current = looks.find((l) => l.id === value);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = looks.filter((l) => terms.every((t) => `${l.name} ${l.family} ${l.id}`.toLowerCase().includes(t)));
  const choose = (id: string | null) => (haptic("selection"), setPrefs({ look: id }), setOpen(false), setQ(""));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {current ? (
          <a href={`/looks/${current.id}`} className="group flex items-center gap-3 rounded-xl bg-s1 p-2 pr-3.5 shadow-[inset_0_0_0_1px_var(--color-line2)]">
            <Tile look={current} bare className="h-12 w-[72px] rounded-lg" />
            <span>
              <span className="block text-[14px] font-semibold">{current.name}</span>
              <span className="flex items-center gap-1 text-[12.5px] text-fg3 group-hover:text-fg2">See the full picture <ArrowUpRight size={12} aria-hidden /></span>
            </span>
          </a>
        ) : (
          <p className="text-[14px] text-fg2">No look set: your agent detects one from each brief, else Minimal.</p>
        )}
        <span className="flex gap-1.5">
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={btn}>{open ? "Close" : current ? "Change" : "Choose a look"}</button>
          {current && <button type="button" onClick={() => choose(null)} className={`${btn} bg-transparent shadow-none text-fg2`}>Clear</button>}
        </span>
      </div>
      {open && (
        <div className="mt-4">
          <label className="flex h-9 items-center gap-2 rounded-[9px] bg-s2 px-2.5 shadow-[inset_0_0_0_1px_var(--color-line)] focus-within:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)]">
            <Search size={14} className="text-fg3" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${looks.length} looks`} aria-label="Search looks" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg3 focus-visible:outline-none" />
          </label>
          <ul className="mt-3 grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-0.5 sm:grid-cols-3 md:grid-cols-4">
            {shown.map((l) => (
              <li key={l.id}>
                <button type="button" aria-pressed={l.id === value} onClick={() => choose(l.id)} className={`press w-full overflow-hidden rounded-xl bg-s1 text-left ${l.id === value ? "shadow-[inset_0_0_0_1.5px_var(--color-fg)]" : "shadow-[inset_0_0_0_1px_var(--color-line2)] hover:shadow-[inset_0_0_0_1px_var(--color-fg3)]"}`}>
                  <Tile look={l} className="h-[72px] w-full" />
                  <span className="flex items-center gap-2 px-2.5 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{l.name}</span>
                      <span className="block truncate text-[11.5px] text-fg3">{l.family}</span>
                    </span>
                    {l.id === value && <Check size={14} className="shrink-0" aria-hidden />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!shown.length && <p className="mt-3 text-[13px] text-fg2">No look matches “{q}”.</p>}
        </div>
      )}
    </div>
  );
}

/** A look in miniature: its ground, a panel in its surface, radius and material, a line of its type, its accent. */
export function Tile({ look: { name, swatch: s }, bare, className = "" }: { look: LookOption; bare?: boolean; className?: string }) {
  return (
    <span aria-hidden className={`grid place-items-center overflow-hidden p-2.5 ${className}`} style={{ background: s.bg, color: s.text }}>
      <span className="flex w-full max-w-[120px] items-center gap-1.5 px-2 py-1.5" style={{ background: s.surface, borderRadius: Math.min(s.radius, 14), ...declarations(s.card) }}>
        {bare ? <i className="h-1.5 flex-1 rounded-full opacity-40" style={{ background: s.text }} /> : <span className="min-w-0 flex-1 truncate text-[11px] leading-tight" style={FONTS[s.font]}>{name}</span>}
        <i className="size-2 shrink-0 rounded-full" style={{ background: s.accent }} />
      </span>
    </span>
  );
}

/** A brief in, the plan text the agent would read out: with the user's taste, or as everyone gets it. */
function TryBrief() {
  const [brief, setBrief] = useState(BRIEFS[0]!);
  const [mine, setMine] = useState(true);
  const [out, setOut] = useState<string>();
  const [busy, setBusy] = useState(false);
  const last = useRef(0); // the newest request wins, so the plan shown always matches the brief and toggle shown
  const run = async (e?: FormEvent, b = brief, m = mine) => {
    e?.preventDefault();
    const n = ++last.current; // even an empty brief cancels the answer still on its way
    if (!b.trim()) return setBusy(false), setOut(undefined);
    setBusy(true);
    if (m) await tasteSaved(); // a choice made just before must be in D1 when the server reads it
    const r = await fetch("/api/try", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brief: b, mine: m }) }).catch(() => null);
    const j = ((await r?.json().catch(() => null)) ?? {}) as { text?: string; error?: string };
    if (n !== last.current) return;
    setBusy(false);
    if (!r?.ok || !j.text) return void toast.error(j.error ?? "Couldn't reach the server.");
    setOut(j.text);
  };
  return (
    <div>
      <form onSubmit={run} className="flex flex-wrap gap-2">
        <input value={brief} onChange={(e) => (setBrief(e.target.value), e.target.value.trim() || run(undefined, ""))} maxLength={300} aria-label="Brief" className="h-9 min-w-0 flex-[1_1_260px] rounded-[9px] bg-s1 px-3 text-[13.5px] shadow-[inset_0_0_0_1px_var(--color-line2)] outline-none focus-visible:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)] focus-visible:outline-none" />
        <Seg label="Whose taste">
          <button type="button" aria-pressed={mine} onClick={() => (setMine(true), (out || busy) && run(undefined, brief, true))}>Mine</button>
          <button type="button" aria-pressed={!mine} onClick={() => (setMine(false), (out || busy) && run(undefined, brief, false))}>Everyone's</button>
        </Seg>
        <button type="submit" disabled={busy} className="press h-9 rounded-[9px] bg-fg px-3.5 text-[13px] font-semibold text-bg disabled:opacity-60">{busy ? "Planning…" : "Plan"}</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {BRIEFS.map((b) => (
          <button key={b} type="button" onClick={() => (setBrief(b), run(undefined, b))} className="rounded-md px-1.5 py-0.5 text-[12px] text-fg3 hover:bg-s2 hover:text-fg">{b}</button>
        ))}
      </div>
      {out && (
        <pre tabIndex={0} aria-label="Your agent's plan" className="mt-3 max-h-[440px] overflow-auto rounded-xl bg-s1 p-3.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-fg2 shadow-[inset_0_0_0_1px_var(--color-line)]">
          {out.split("\n").map((line, i) => (
            // The lines a user's taste changes read brighter: the look and framework, and the notes about hidden items.
            <span key={i} className={/^(look|framework):|^the user /.test(line) ? "text-fg" : undefined}>{line}{"\n"}</span>
          ))}
        </pre>
      )}
    </div>
  );
}

const CLIENTS = ["Terminal", "Claude Code", "Cursor", "Codex", "VS Code"] as const;
type Client = (typeof CLIENTS)[number];

/** Setup for one client with the key in it. Shown only right after making a key, the one time the browser has it. */
function setup(client: Client, key: string) {
  const url = `${location.origin}/mcp`;
  const header = `Bearer ${key}`;
  const json = (v: unknown) => JSON.stringify(v, null, 2);
  switch (client) {
    case "Terminal":
      return `npx -y tastebase@latest login --token ${key}`;
    case "Claude Code":
      return `claude mcp add --transport http tastebase ${url} --header "Authorization: ${header}"`;
    case "Cursor":
      return `// .cursor/mcp.json\n${json({ mcpServers: { tastebase: { url, headers: { Authorization: header } } } })}`;
    case "Codex":
      return `# ~/.codex/config.toml\n[mcp_servers.tastebase]\nurl = "${url}"\nhttp_headers = { "Authorization" = "${header}" }`;
    case "VS Code":
      return `// .vscode/mcp.json\n${json({ servers: { tastebase: { type: "http", url, headers: { Authorization: header } } } })}`;
  }
}

const date = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// The key just made, and one on its way, kept while this tab keeps the site's code (soft navigations included), so
// leaving the Connect panel before or after it arrives never loses it.
let made: string | undefined;
let making: Promise<string | undefined> | undefined;

function KeyPanel({ keys }: { keys: AgentKey[] }) {
  const [fresh, setFresh] = useState(made);
  const [busy, setBusy] = useState(!!making);
  useEffect(() => void making?.then((k) => (setFresh(k), setBusy(false))), []);
  const [client, setClient] = useState<Client>("Terminal");
  const [sure, setSure] = useState<string>(); // signing an agent out asks once: it has no undo
  const make = async () => {
    setBusy(true);
    making ??= makeAgentKey().then((k) => ((made = k ?? made), (making = undefined), made));
    setFresh(await making), setBusy(false);
  };
  const ask = `set up tastebase and sign me in: ${location.origin}/llms.txt`;
  return (
    <div>
      <div className="rounded-xl bg-s1 p-3 shadow-[inset_0_0_0_1px_var(--color-line2)]">
        <p className="text-[13px] font-semibold">In your agent's chat, send</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-s3 px-2.5 py-2 font-mono text-[12px]">{ask}</code>
          <CopyButton value={ask} quiet />
        </div>
        <p className="mt-2 text-[12.5px] text-fg3">
          Your agent opens a page here for you to approve. Or in a terminal: <code className="font-mono text-[12px] text-fg2">npx -y tastebase@latest login</code>
        </p>
      </div>
      {keys.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-xl shadow-[inset_0_0_0_1px_var(--color-line2)]">
          {keys.map((k) => (
            <Row key={k.id} title={k.name} sub={`tb_sk_…${k.last4} · ${date(k.createdAt)}`}>
              {sure === k.id ? (
                <button type="button" onClick={() => void revokeAgentKey(k.id).then((ok) => ok && fresh?.endsWith(k.last4) && ((made = undefined), setFresh(undefined)))} className={`${btn} text-[#ff7b7b]`}>Sign out for good</button>
              ) : (
                <Undo onClick={() => setSure(k.id)}>Sign out</Undo>
              )}
            </Row>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-fg3">Each agent signs in with its own key. Signing one out stops only that one.</p>
        <button type="button" disabled={busy} onClick={make} className={btn}>{busy ? "Making…" : "Make a key"}</button>
      </div>
      {fresh && (
        <div className="mt-3 rounded-xl bg-s1 p-3 shadow-[inset_0_0_0_1px_var(--color-line2)]">
          <p className="text-[13px] font-semibold">Copy it now. We keep only a hash, so it can't be shown again.</p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-s3 px-2.5 py-2 font-mono text-[12px]">{fresh}</code>
            <CopyButton value={fresh} quiet />
          </div>
          <div className="mt-3 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
            <Seg label="Client">
              {CLIENTS.map((c) => <button key={c} type="button" aria-pressed={client === c} onClick={() => setClient(c)}>{c}</button>)}
            </Seg>
            <span className="ml-auto"><CopyButton value={setup(client, fresh)} quiet /></span>
          </div>
          <pre tabIndex={0} className="mt-2 overflow-x-auto rounded-lg bg-s3 p-2.5 font-mono text-[11.5px] leading-relaxed text-fg2">{setup(client, fresh)}</pre>
        </div>
      )}
    </div>
  );
}

function DeleteAccount() {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const go = async () => {
    setBusy(true);
    const r = await deleteAccount();
    if (r === "done") return toast("Account deleted"), location.assign("/");
    setBusy(false);
    setStale(r === "stale");
  };
  // better-auth deletes only from a session made in the last day; signing in again lands back here.
  if (stale)
    return (
      <span className="flex items-center gap-2">
        <span className="text-[12.5px] text-fg2">Sign in again first</span>
        <button type="button" onClick={() => signOut().then(askSignIn)} className={btn}>Sign in again</button>
      </span>
    );
  return sure ? (
    <span className="flex gap-1.5">
      <button type="button" onClick={() => setSure(false)} className={`${btn} bg-transparent text-fg2 shadow-none`}>Keep it</button>
      <button type="button" disabled={busy} onClick={go} className={`${btn} text-[#ff7b7b]`}>{busy ? "Deleting…" : "Delete for good"}</button>
    </span>
  ) : (
    <button type="button" onClick={() => setSure(true)} className={`${btn} text-[#ff7b7b]`}>Delete</button>
  );
}

async function download(a: ReturnType<typeof useAccount>) {
  const requests = await loadRequests().then((r) => r.mine, () => undefined);
  if (!requests) toast.error("Downloaded without your requests: they didn't load. Try again for a full copy.");
  const data = { name: a.user?.name, look: a.look, framework: a.framework, hearts: a.saved, folders: a.folders, hidden: a.hidden.map((h) => h.id), offLook: a.offLook.map(({ id, look }) => ({ item: id, look })), requests };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  Object.assign(document.createElement("a"), { href: url, download: "tastebase-account.json" }).click();
  setTimeout(() => URL.revokeObjectURL(url)); // Safari cancels a download whose URL is revoked in the same task
}

/** A panel's heading and lead. It carries no id equal to its hash, so opening it never jumps the page. */
function Panel({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="panel-title">
      <h2 id="panel-title" className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
      {lead && <p className="mt-0.5 max-w-[62ch] text-[13px] text-fg2">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const field = "flex h-9 items-center gap-2 rounded-[9px] bg-s2 px-2.5 shadow-[inset_0_0_0_1px_var(--color-line)] focus-within:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)]";
const input = "min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg3 focus-visible:outline-none";

/** Hidden (never offered) and Wrong for a look (left out under that look only), with a search to hide any library. */
function Dislikes({ libs, lookName }: { libs: Record<string, LibName>; lookName: (id: string) => string }) {
  const a = useAccount();
  const [tab, setTab] = useState<"hidden" | "off">(() => (location.hash === "#off-look" ? "off" : "hidden"));
  const [q, setQ] = useState("");
  const hid = new Set(a.hidden.map((h) => h.id));
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const found = terms.length ? Object.entries(libs).filter(([id, l]) => !hid.has(id) && terms.every((t) => `${l.name} ${id}`.toLowerCase().includes(t))).slice(0, 6) : [];
  return (
    <Panel title="Dislikes" lead="Your agent never offers these. Hide one here, with the eye on any card, or tell your agent “never recommend it”.">
      <Seg label="Which list">
        <button type="button" aria-pressed={tab === "hidden"} onClick={() => setTab("hidden")}>Hidden {a.hidden.length}</button>
        <button type="button" aria-pressed={tab === "off"} onClick={() => setTab("off")}>Wrong for a look {a.offLook.length}</button>
      </Seg>
      {tab === "hidden" ? (
        <div className="mt-3">
          <label className={field}>
            <Search size={14} className="text-fg3" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hide a library…" aria-label="Find a library to hide" className={input} />
          </label>
          {terms.length > 0 && (
            <div className="mt-2">
              <Rows empty={`No library matches “${q}”, or it is hidden already.`}>
                {found.map(([id, l]) => (
                  <Row key={id} thumb={id} title={l.name} sub={l.kind} href={`/browse/${id}`}>
                    <button type="button" onClick={() => (haptic("selection"), toggleHidden({ id, name: l.name, href: `/browse/${id}` }), setQ(""))} className={btn}>Hide</button>
                  </Row>
                ))}
              </Rows>
            </div>
          )}
          <div className="mt-3">
            <Rows empty="Nothing hidden.">
              {a.hidden.map((h) => (
                <Row key={h.id} thumb={libs[h.id] ? h.id : undefined} title={h.name} sub={h.id.includes("/") ? "One part of a kit" : libs[h.id]?.kind} href={h.href}>
                  <Undo onClick={() => toggleHidden(h)}>Undo</Undo>
                </Row>
              ))}
            </Rows>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-[13px] text-fg2">Left out under that look only, still offered for the rest. Mark one on a look's page, or tell your agent it clashes.</p>
          <Rows empty="No marks yet.">
            {a.offLook.map((o) => (
              <Row key={`${o.look} ${o.id}`} title={o.name} sub={`wrong for ${lookName(o.look)}`} href={o.href}>
                <Undo onClick={() => toggleOffLook(o)}>Undo</Undo>
              </Row>
            ))}
          </Rows>
        </div>
      )}
    </Panel>
  );
}

/** Folders: the list and a new-folder field, then the open folder's libraries with its controls and the hearts to add. */
function Folders({ libs }: { libs: Record<string, LibName> }) {
  const a = useAccount();
  const [open, setOpen] = useState<string>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const f = a.folders.find((x) => x.id === open) ?? a.folders[0];
  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    const id = await createFolder(draft);
    if (id) setDraft(""), setOpen(id), haptic("success");
    setBusy(false);
  };
  const add = f ? a.saved.filter((id) => !f.libs.includes(id) && libs[id]) : [];
  return (
    <Panel title="Folders" lead="Group libraries your way. A folder is private until you share its link.">
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div>
          <form onSubmit={create} className="flex gap-1.5">
            <label className={`${field} flex-1`}>
              <FolderPlus size={14} className="shrink-0 text-fg3" aria-hidden />
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} placeholder="New folder" aria-label="New folder name" autoComplete="off" className={input} />
            </label>
            {draft.trim() && <button type="submit" disabled={busy} className={btn}>Create</button>}
          </form>
          <ul className="mt-2 grid gap-0.5">
            {a.folders.map((x) => (
              <li key={x.id}>
                <button type="button" aria-pressed={x.id === f?.id} onClick={() => (haptic("selection"), setOpen(x.id))} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] ${x.id === f?.id ? "bg-s2 text-fg shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-fg2 hover:bg-s2 hover:text-fg"}`}>
                  <span className="min-w-0 flex-1 truncate">{x.name}</span>
                  {x.public && <Globe size={12} className="shrink-0 text-fg3" aria-label="Shared" />}
                  <span className="font-mono text-[11px] text-fg3 tabular-nums">{x.libs.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {f ? (
          <div className="min-w-0">
            <FolderControls folder={f} title={<h3 className="min-w-0 truncate text-[15px] font-semibold"><a href={`/f/${f.id}`} className="hover:underline">{f.name}</a></h3>} onDeleted={() => setOpen(undefined)} />
            <div className="mt-3">
              <Rows empty="Empty for now. Add from your hearts below, or use the folder button on any library.">
                {f.libs.map((id) => (
                  <Row key={id} thumb={libs[id] ? id : undefined} title={libs[id]?.name ?? id} sub={libs[id]?.kind} href={`/browse/${id}`}>
                    <Undo onClick={() => updateFolder(f.id, { remove: id })}>Remove</Undo>
                  </Row>
                ))}
              </Rows>
            </div>
            {add.length > 0 && (
              <>
                <h4 className="mt-5 text-[12.5px] font-medium text-fg3">Add from your hearts</h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {add.slice(0, 24).map((id) => (
                    <button key={id} type="button" onClick={() => (haptic("selection"), updateFolder(f.id, { add: id }))} className={`${btn} gap-1 font-medium`}>
                      <Plus size={13} aria-hidden /> {libs[id]!.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-s1 px-3.5 py-3 text-[13px] text-fg2 shadow-[inset_0_0_0_1px_var(--color-line)]">No folders yet. Name one to start, or use the folder button on any library.</p>
        )}
      </div>
    </Panel>
  );
}

const STATUS: Record<SiteRequest["status"], [string, string]> = {
  open: ["Waiting", "bg-s3 text-fg2"],
  added: ["Added", "bg-green/10 text-green"],
  declined: ["Declined", "bg-[#ff7b7b]/10 text-[#ff7b7b]"],
};

/** Requests to list a site: a link and a note in, your requests with their status, and for an admin the queue. */
/** `hrefs`: every library and resource id to its page, for "See it" and the admin's id suggestions. */
function Requests({ hrefs, admin }: { hrefs: Record<string, string>; admin: boolean }) {
  const [data, setData] = useState<{ mine: SiteRequest[]; open?: SiteRequest[] }>();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string }>();
  // Only the newest read may land: an older one (the first load, a settle) answering late must not undo a newer list.
  const asked = useRef(0);
  const reload = () => {
    const n = ++asked.current;
    return loadRequests().then((d) => n === asked.current && setData(d), (e: Error) => toast.error(e.message));
  };
  useEffect(() => void reload(), []);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true), setError(undefined);
    const r = await sendRequest(url, note);
    setBusy(false);
    if ("error" in r) return setError({ text: r.request ? `${r.error} It is ${STATUS[r.request.status][0].toLowerCase()}.` : r.error, field: r.field });
    haptic("success"), setUrl(""), setNote("");
    void reload(); // the user's list and, for an admin, the queue: read after the write, so it can't come back stale
  };
  return (
    <Panel title="Requests" lead="Know a library or design site we should list? Send the link. We try each one by hand.">
      <form onSubmit={send} className="rounded-xl bg-s1 p-3 shadow-[inset_0_0_0_1px_var(--color-line2)]">
        <label className={field}>
          <Link2 size={14} className="shrink-0 text-fg3" aria-hidden />
          <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required placeholder="https://" aria-label="Link" aria-invalid={error?.field === "url"} aria-describedby={error ? "request-error" : undefined} autoComplete="url" className={input} />
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="What is it good for? (optional)" aria-label="Note" className="mt-2 w-full resize-y rounded-[9px] bg-s2 px-2.5 py-2 text-[13.5px] shadow-[inset_0_0_0_1px_var(--color-line)] outline-none placeholder:text-fg3 focus-visible:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)] focus-visible:outline-none" />
        <div className="mt-2 flex items-center gap-3">
          {error && <p id="request-error" role="alert" className="min-w-0 flex-1 text-[12.5px] text-[#ff7b7b]">{error.text}</p>}
          <button type="submit" disabled={busy || !url.trim()} className="press ml-auto h-8 rounded-lg bg-fg px-3 text-[13px] font-semibold text-bg disabled:opacity-50">{busy ? "Sending…" : "Send request"}</button>
        </div>
      </form>

      <div className="mt-4">
        {data ? (
          <Rows empty="No requests yet.">
            {data.mine.map((r) => (
              <RequestRow key={r.id} r={r} hrefs={hrefs}>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
              </RequestRow>
            ))}
          </Rows>
        ) : (
          <div className="h-12 rounded-xl bg-s1" aria-busy="true" />
        )}
      </div>

      {admin && data?.open && (
        <>
          <h3 className="mt-8 text-[13px] font-semibold">Everyone's waiting requests <span className="font-mono text-[11px] font-normal text-fg3">admin</span></h3>
          <p className="mt-0.5 mb-3 text-[13px] text-fg2">Settling a link settles every request for it. Requesters see the outcome in their list.</p>
          <Rows empty="Nothing waiting.">
            {data.open.map((r) => (
              <RequestRow key={r.id} r={r} hrefs={hrefs}>
                <Settle r={r} ids={hrefs} done={reload} />
              </RequestRow>
            ))}
          </Rows>
        </>
      )}
    </Panel>
  );
}

function RequestRow({ r, hrefs, children }: { r: SiteRequest; hrefs: Record<string, string>; children: ReactNode }) {
  const sub = [r.by && `from ${r.by}`, date(r.createdAt), r.note && `“${r.note}”`, r.status === "declined" && r.reason].filter(Boolean).join(" · ");
  return (
    <li className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2">
      <div className="min-w-0 flex-1">
        <a href={r.url} target="_blank" rel="nofollow noopener noreferrer" className="block truncate text-[14px] font-medium hover:underline">{r.host}</a>
        <p title={sub} className="line-clamp-3 text-[12.5px] break-words text-fg3">{sub}</p>
      </div>
      {r.status === "added" && r.libId && hrefs[r.libId] && <a href={hrefs[r.libId]} className="text-[12.5px] font-medium text-fg2 hover:text-fg">See it</a>}
      {children}
    </li>
  );
}

/** An admin's Mark added (with the registry id it became) or Decline (with a reason), for every request for a link. */
function Settle({ r, ids, done }: { r: SiteRequest; ids: Record<string, string>; done: () => void }) {
  const [mode, setMode] = useState<"added" | "declined">();
  const list = useId();
  const [value, setValue] = useState("");
  const go = async (e: FormEvent) => {
    e.preventDefault();
    const n = await settleRequest(r.url, mode === "added" ? { status: "added", libId: value.trim() } : { status: "declined", reason: value.trim() });
    if (n !== undefined) toast.success(`Settled ${n} ${n === 1 ? "request" : "requests"}`), done();
  };
  if (!mode)
    return (
      <span className="flex gap-1.5">
        <button type="button" onClick={() => setMode("declined")} className={`${btn} bg-transparent text-fg2 shadow-none`}>Decline</button>
        <button type="button" onClick={() => setMode("added")} className={btn}>Mark added</button>
      </span>
    );
  return (
    <form onSubmit={go} className="flex basis-full gap-1.5 sm:basis-auto">
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} list={mode === "added" ? list : undefined} required={mode === "added"} maxLength={200} placeholder={mode === "added" ? "Registry id" : "Reason (optional)"} aria-label={mode === "added" ? "Registry id it was added as" : "Why it was declined"} className="h-8 min-w-0 flex-1 rounded-lg bg-s2 px-2.5 text-[13px] shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus-visible:shadow-[inset_0_0_0_1px_rgb(91_124_255/0.6)] focus-visible:outline-none sm:w-44" />
      {mode === "added" && <datalist id={list}>{Object.keys(ids).map((id) => <option key={id} value={id} />)}</datalist>}
      <button type="button" onClick={() => (setMode(undefined), setValue(""))} className={`${btn} bg-transparent text-fg2 shadow-none`}>Cancel</button>
      <button type="submit" className={btn}>{mode === "added" ? "Added" : "Decline"}</button>
    </form>
  );
}
