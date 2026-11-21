// One public form (submit a tool, feedback, sponsor): its fields, a Turnstile check, and POST /api/forms. The sitekey
// comes from GET /api/forms because pages are prerendered. Field errors from the server land under their field.
// The loading shimmer runs only until Turnstile renders.
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { categories } from "../lib/categories.ts";
import type { FormId } from "../lib/forms.ts";
import { haptic } from "../lib/haptics.ts";
import { useTheme } from "../lib/theme.ts";

type Field = { name: string; label: string; type: "text" | "url" | "email" | "textarea" | "select"; placeholder?: string; optional?: boolean; half?: boolean };
const FIELDS: Record<FormId, Field[]> = {
  submit: [
    { name: "name", label: "Name", type: "text", placeholder: "Vaul", half: true },
    { name: "url", label: "Link", type: "url", placeholder: "https://example.com", half: true },
    { name: "category", label: "Category", type: "select", half: true },
    { name: "email", label: "Your email", type: "email", placeholder: "you@example.com", half: true },
    { name: "reason", label: "Why it belongs here", type: "textarea", placeholder: "What job does it do better than what we list?" },
  ],
  feedback: [
    { name: "email", label: "Your email", type: "email", placeholder: "you@example.com (if you'd like a reply)", optional: true },
    { name: "message", label: "Message", type: "textarea", placeholder: "What's wrong, missing or great?" },
  ],
  sponsor: [
    { name: "company", label: "Company", type: "text", placeholder: "Acme", half: true },
    { name: "url", label: "Website", type: "url", placeholder: "https://example.com", half: true },
    { name: "email", label: "Your email", type: "email", placeholder: "you@example.com" },
    { name: "message", label: "Message", type: "textarea", placeholder: "Tell us about your product and what you're looking for." },
  ],
};
const SUBMIT: Record<FormId, string> = { submit: "Submit", feedback: "Send feedback", sponsor: "Send inquiry" };
const DONE: Record<FormId, [string, string]> = {
  submit: ["Thanks, it's in the queue", "We try every submission before it's listed. If it makes the cut, it shows up here."],
  feedback: ["Thanks for telling us", "Every message is read. If you left an email, a reply comes from a person."],
  sponsor: ["Thanks, we'll be in touch", "Expect a reply by email with dates and placement within two days."],
};

type Turnstile = { render: (el: HTMLElement, o: { sitekey: string; theme: string; callback: (t: string) => void; "expired-callback": () => void }) => string; reset: (id: string) => void; remove: (id: string) => void };
declare global {
  interface Window { turnstile?: Turnstile }
}

/** Loads the Turnstile script once per page session. */
let script: Promise<void> | undefined;
const loadTurnstile = () =>
  (script ??= new Promise((ok, fail) => {
    const s = Object.assign(document.createElement("script"), { src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async: true, onload: () => ok(), onerror: fail });
    document.head.appendChild(s);
  }));

export default function Form({ form }: { form: FormId }) {
  const theme = useTheme();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string>(undefined);
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "off">("idle");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const id = useId();

  useEffect(() => {
    let gone = false;
    fetch("/api/forms")
      .then((r) => r.json() as Promise<{ sitekey: string; ready: boolean }>)
      .then(async ({ sitekey, ready }) => {
        if (!ready) return setState("off");
        await loadTurnstile();
        if (gone || !box.current || !window.turnstile) return;
        box.current.replaceChildren();
        widget.current = window.turnstile.render(box.current, { sitekey, theme, callback: setToken, "expired-callback": () => setToken("") });
      })
      .catch(() => setError("The form couldn't load. Refresh to try again."));
    return () => {
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current), (widget.current = undefined);
    };
  }, [theme]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return setError("Complete the check below first.");
    setState("sending"), setError(""), setFieldErrors({});
    const fields = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]));
    const res = await fetch("/api/forms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ form, token, fields }) }).catch(() => undefined);
    const body = (await res?.json().catch(() => ({}))) as { ok?: boolean; error?: string; fields?: Record<string, string> } | undefined;
    if (res?.ok && body?.ok) {
      if (widget.current) window.turnstile?.remove(widget.current), (widget.current = undefined);
      return setState("done"), haptic("success");
    }
    setState("idle");
    setError(body?.error ?? "Couldn't send that. Check your connection and try again.");
    setFieldErrors(body?.fields ?? {});
    if (widget.current) window.turnstile?.reset(widget.current), setToken("");
  };

  if (state === "done")
    return (
      <div role="status" className="enter mt-8 rounded-xl bg-s1 p-6 shadow-[inset_0_0_0_1px_var(--color-line)]">
        <span className="grid size-9 place-items-center rounded-full bg-green/15 text-green"><Check size={18} aria-hidden /></span>
        <p className="mt-4 text-[17px] font-semibold">{DONE[form][0]}</p>
        <p className="mt-1 text-[14px] text-fg2">{DONE[form][1]}</p>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate={false} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
      {FIELDS[form].map((f) => (
        <Label key={f.name} id={`${id}-${f.name}`} label={f.label} optional={f.optional} error={fieldErrors[f.name]} wide={!f.half}>
          {f.type === "textarea" ? (
            <textarea id={`${id}-${f.name}`} name={f.name} aria-invalid={!!fieldErrors[f.name]} aria-describedby={fieldErrors[f.name] ? `${id}-${f.name}-err` : undefined} rows={5} required={!f.optional} maxLength={4000} placeholder={f.placeholder} className={`${field} resize-y py-2.5`} />
          ) : f.type === "select" ? (
            <select id={`${id}-${f.name}`} name={f.name} aria-invalid={!!fieldErrors[f.name]} aria-describedby={fieldErrors[f.name] ? `${id}-${f.name}-err` : undefined} required defaultValue="" className={`${field} h-11`}>
              <option value="" disabled>Choose one</option>
              <option value="library">UI library</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          ) : (
            <input id={`${id}-${f.name}`} name={f.name} aria-invalid={!!fieldErrors[f.name]} aria-describedby={fieldErrors[f.name] ? `${id}-${f.name}-err` : undefined} type={f.type} required={!f.optional} maxLength={f.type === "url" ? 500 : 200} placeholder={f.placeholder} autoComplete={f.type === "email" ? "email" : f.type === "url" ? "url" : "off"} className={`${field} h-11`} />
          )}
        </Label>
      ))}
      <div className="md:col-span-2">
        <div ref={box} className="min-h-[65px]">{state === "off" ? null : <span className="t-shimmer text-[12px]" data-text="Loading the human check">Loading the human check</span>}</div>
        {state === "off" && <p className="text-[13.5px] text-fg2">Forms aren't set up on this copy of tastebase yet. <a href="/contribute" className="text-fg underline underline-offset-4">Open an issue on GitHub</a> instead.</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--color-pink)_12%,transparent)] px-3.5 py-2.5 text-[13.5px] text-pink">{error}</p>}
        <button type="submit" disabled={state !== "idle"} className="press group mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fg px-5 text-[14px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 md:w-auto">
          {state === "sending" ? "Sending" : SUBMIT[form]}
          <ArrowRight size={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </form>
  );
}

const field = "w-full rounded-lg bg-s1 px-3 text-[14px] shadow-[inset_0_0_0_1px_var(--color-line2)] transition-shadow placeholder:text-fg3 hover:shadow-[inset_0_0_0_1px_var(--color-fg3)] focus-visible:shadow-[inset_0_0_0_1px_var(--color-blue)] focus-visible:outline-none aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--color-pink)]";

function Label({ id, label, optional, error, wide, children }: { id: string; label: string; optional?: boolean; error?: string; wide: boolean; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 ${wide ? "md:col-span-2" : ""}`}>
      <label htmlFor={id} className="text-[13.5px] font-medium text-fg2">
        {label} {optional && <span className="text-fg3">(optional)</span>}
      </label>
      {children}
      {error && <p id={`${id}-err`} className="text-[12.5px] text-pink">{error}</p>}
    </div>
  );
}
