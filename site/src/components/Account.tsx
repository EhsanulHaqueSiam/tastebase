// /account: everything that shapes a signed-in user's agent, on one page. Their look and framework (used when a brief
// names none), a preview of the plan their agent gets, hearts, what they hid, what they marked wrong for one look, their
// agent key and its setup, and their data. Reads the account store (lib/saved.ts); the page itself is static.
import { ArrowUpRight, Check, Download, Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { frameworks, type Framework, type Swatch } from "../../../src/registry/schema.ts";
import { haptic } from "../lib/haptics.ts";
import { shot, thumb } from "../lib/kinds.ts";
import { askSignIn, deleteAccount, tasteSaved, makeAgentKey, type AgentKey, refreshAccount, revokeAgentKey, setPrefs, signOut, toggleHidden, toggleOffLook, toggleSaved, useAccount } from "../lib/saved.ts";
import { declarations, FONTS } from "../lib/swatch.ts";
import { Avatar } from "./AccountSheet.tsx";
import { CopyButton } from "./fx.tsx";
import { Seg } from "./Seg.tsx";

/** One look as the picker draws it; `family` is its family's name, or its own for a family. */
export type LookOption = { id: string; name: string; family: string; swatch: Swatch };
/** A library by id: its name and kind label, for the hearts list. */
export type LibName = { name: string; kind: string };

const SECTIONS = [
  ["look", "Look"],
  ["try", "Try your agent"],
  ["hearts", "Hearts"],
  ["hidden", "Hidden"],
  ["off-look", "Wrong for a look"],
  ["key", "Connect your agent"],
  ["data", "Your data"],
] as const;

const FRAMEWORK_NAMES: Record<Framework, string> = { react: "React", vue: "Vue", svelte: "Svelte", solid: "Solid", angular: "Angular", vanilla: "Vanilla JS", "react-native": "React Native" };
// None names a look, so the saved one shows; a look the brief names would win over it.
const BRIEFS = ["pricing page with a signup form", "habit tracker with charts and a bottom sheet", "settings page with a data table"];

export default function Account({ looks, libs }: { looks: LookOption[]; libs: Record<string, LibName> }) {
  const a = useAccount();
  // The agent's taste tool may have changed the account since the store loaded on another page.
  useEffect(() => void refreshAccount(), []);

  if (!a.user)
    return (
      <Shell>
        {!a.loading && (
          <div className="mt-16 grid justify-items-center text-center">
            <p className="max-w-[360px] text-fg2">Sign in to set your look, see the plan your agent gets, and control what it recommends.</p>
            <button type="button" onClick={askSignIn} className="press mt-5 h-10 rounded-xl bg-fg px-4 text-[14px] font-semibold text-bg active:scale-95">Sign in</button>
          </div>
        )}
      </Shell>
    );

  const lookById = new Map(looks.map((l) => [l.id, l]));
  const counts: Partial<Record<(typeof SECTIONS)[number][0], number>> = { hearts: a.saved.length, hidden: a.hidden.length, "off-look": a.offLook.length };

  return (
    <Shell>
      <div className="mt-6 grid gap-x-12 lg:grid-cols-[180px_1fr]">
        <nav aria-label="Account sections" className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:sticky lg:top-[76px] lg:mx-0 lg:mb-0 lg:grid lg:self-start lg:px-0">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="flex shrink-0 items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] text-fg2 hover:bg-s2 hover:text-fg">
              {label}
              {counts[id] !== undefined && <span className="font-mono text-[11px] text-fg3 tabular-nums">{counts[id]}</span>}
            </a>
          ))}
        </nav>

        <div className="min-w-0 max-w-[760px]">
          <div className="flex items-center gap-3 border-b border-line pb-5">
            <Avatar user={a.user} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold">{a.user.name}</p>
              <p className="text-[13px] text-fg2">Everything here changes what your agent recommends.</p>
            </div>
            <button type="button" onClick={() => signOut()} className="press rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-fg2 hover:text-fg">Sign out</button>
          </div>

          <Section id="look" title="Your look" lead="When a brief names no look, your agent builds in this one instead of Minimal. A look the brief names still wins.">
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
          </Section>

          <Section id="try" title="Try your agent" lead="Type a brief and read the plan your agent gets: the same text, with your look, hearts and hidden items applied.">
            <TryBrief />
          </Section>

          <Section id="hearts" title="Hearts" lead="A hearted library wins a close call in your agent's picks. It never beats a clearly better fit.">
            <Rows empty="Nothing hearted yet. Use the heart on any library.">
              {a.saved.map((id) => (
                <Row key={id} thumb={id} title={libs[id]?.name ?? id} sub={libs[id]?.kind} href={`/browse/${id}`}>
                  <Undo onClick={() => toggleSaved(id)}>Remove</Undo>
                </Row>
              ))}
            </Rows>
            <p className="mt-3 text-[13px] text-fg2">
              {a.folders.length} {a.folders.length === 1 ? "folder" : "folders"}.{" "}
              <a href="/folders" className="font-medium text-fg underline decoration-fg3 underline-offset-4 hover:decoration-fg">Manage folders</a>
            </p>
          </Section>

          <Section id="hidden" title="Hidden from your agent" lead="Never offered, under any look. Hide a library with the eye on its card, or tell your agent “never recommend it”.">
            <Rows empty="Nothing hidden.">
              {a.hidden.map((h) => (
                <Row key={h.id} title={h.name} sub={h.id.includes("/") ? "One part of a kit" : undefined} href={h.href}>
                  <Undo onClick={() => toggleHidden(h)}>Undo</Undo>
                </Row>
              ))}
            </Rows>
          </Section>

          <Section id="off-look" title="Wrong for a look" lead="Left out under that look only, still offered for the rest. Mark one on a look's page, or tell your agent it clashes.">
            <Rows empty="No marks yet.">
              {a.offLook.map((o) => (
                <Row key={`${o.look} ${o.id}`} title={o.name} sub={`wrong for ${lookById.get(o.look)?.name ?? o.look}`} href={o.href}>
                  <Undo onClick={() => toggleOffLook(o)}>Undo</Undo>
                </Row>
              ))}
            </Rows>
          </Section>

          <Section id="key" title="Connect your agent" lead="Signed in, your agent follows everything above: it never offers what you hid and builds in your look. Without it, your agent gets the same answers as everyone.">
            <KeyPanel keys={a.keys} />
          </Section>

          <Section id="data" title="Your data">
            <Rows>
              <Row title="Download everything" sub="Hearts, folders, look, framework, hidden and off-look marks, as JSON">
                <button type="button" onClick={() => download(a)} className={btn}><Download size={14} aria-hidden /> Download</button>
              </Row>
              <Row title="Retake the taste cards" sub="Six looks, then libraries that fit the ones you like">
                <button type="button" onClick={() => dispatchEvent(new Event("tb:survey"))} className={btn}>Start</button>
              </Row>
              <Row title="Delete account" sub="Removes your account, agent keys and everything above. Shared folder links stop working.">
                <DeleteAccount />
              </Row>
            </Rows>
          </Section>
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

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-[76px] border-b border-line py-7">
      <h2 id={`${id}-h`} className="text-[15px] font-semibold">{title}</h2>
      {lead && <p className="mt-0.5 max-w-[62ch] text-[13px] text-fg2">{lead}</p>}
      <div className="mt-3.5">{children}</div>
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

function KeyPanel({ keys }: { keys: AgentKey[] }) {
  const [fresh, setFresh] = useState<string>();
  const [client, setClient] = useState<Client>("Terminal");
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState<string>(); // signing an agent out asks once: it has no undo
  const make = async () => (setBusy(true), setFresh((await makeAgentKey()) ?? fresh), setBusy(false));
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
                <button type="button" onClick={() => void revokeAgentKey(k.id)} className={`${btn} text-[#ff7b7b]`}>Sign out for good</button>
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

function download(a: ReturnType<typeof useAccount>) {
  const data = { name: a.user?.name, look: a.look, framework: a.framework, hearts: a.saved, folders: a.folders, hidden: a.hidden.map((h) => h.id), offLook: a.offLook.map(({ id, look }) => ({ item: id, look })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  Object.assign(document.createElement("a"), { href: url, download: "tastebase-account.json" }).click();
  setTimeout(() => URL.revokeObjectURL(url)); // Safari cancels a download whose URL is revoked in the same task
}
