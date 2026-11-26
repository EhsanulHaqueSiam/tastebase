// /connect?code=XXXX-XXXX&name=host: where `tastebase login` sends the browser. The signed-in user checks the code
// against their terminal and approves it; the terminal then claims a key named after its machine.
import { useState } from "react";
import { codeFrom } from "../../../src/login-code.ts";
import { haptic } from "../lib/haptics.ts";
import { approveLogin, askSignIn, useAccount } from "../lib/saved.ts";

export default function Connect() {
  const a = useAccount();
  const q = new URLSearchParams(location.search);
  const code = codeFrom(q.get("code"));
  const name = q.get("name")?.trim().slice(0, 40) || "Terminal";
  const [state, setState] = useState<"ask" | "busy" | "done" | "no">("ask");
  const [error, setError] = useState<string>();
  const approve = async () => {
    setState("busy");
    const e = await approveLogin(code!, name);
    if (!e) haptic("success");
    setError(e);
    setState(e ? "ask" : "done");
  };

  const body = !code ? (
    <p className="text-fg2">This link has no sign-in code. Run <code className="font-mono text-[13px] text-fg">npx -y tastebase@latest login</code> again.</p>
  ) : state === "done" ? (
    <>
      <p className="font-semibold text-green">Signed in</p>
      <p className="mt-1 text-fg2">Go back to your terminal. Your agent now follows your taste.</p>
    </>
  ) : state === "no" ? (
    <p className="text-fg2">Not approved. Close this tab; the terminal gives up in 10 minutes.</p>
  ) : a.loading ? null : !a.user ? (
    <>
      <p className="text-fg2">Sign in to connect your agent to your account.</p>
      <button type="button" onClick={askSignIn} className="press mt-5 h-10 rounded-xl bg-fg px-4 text-[14px] font-semibold text-bg active:scale-95">Sign in</button>
    </>
  ) : (
    <>
      <p className="text-fg2">Approve only if your terminal shows this code.</p>
      <p className="mt-4 font-mono text-[28px] font-semibold tracking-[0.12em]">{code}</p>
      <p className="text-[13px] text-fg3">on {name}, as {a.user.name}</p>
      {error && <p role="alert" className="mt-3 text-[13px] text-[#ff7b7b]">{error}</p>}
      <div className="mt-5 flex gap-1.5">
        <button type="button" onClick={() => setState("no")} className="press h-9 rounded-lg px-3 text-[13px] font-semibold text-fg2 hover:text-fg">Cancel</button>
        <button type="button" disabled={state === "busy"} onClick={approve} className="press h-9 rounded-lg bg-fg px-4 text-[13px] font-semibold text-bg disabled:opacity-50">{state === "busy" ? "Approving…" : "Approve"}</button>
      </div>
    </>
  );

  return (
    <section aria-labelledby="connect-title" className="mx-auto grid max-w-[480px] justify-items-center px-4 pt-[120px] pb-24 text-center">
      <h1 id="connect-title" className="mb-2 text-[18px] font-semibold tracking-[-0.02em]">Sign in your agent</h1>
      {body}
    </section>
  );
}
