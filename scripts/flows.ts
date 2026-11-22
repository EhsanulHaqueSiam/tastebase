// pnpm flows <url> [name ...]: walks the site's flows the way a person does (real mouse, keys and wheel through the
// DevTools protocol) at phone and desktop sizes, and fails on the first broken step of each: the /browse sheet (open,
// close by ×, Esc, backdrop and Back, Forward, "Try these", a job while open, and its layout beside the nav rail on wide
// screens), filters and scroll surviving Back, detail panels that must not scroll the page, the taste survey, the
// card buttons signed out, keyboard focus (skip link, sheets that take focus and give it back), and a tab left open
// across a deploy. Against `pnpm dev`
// it also signs up a throwaway user and checks the account (hearts, folders, hiding, the agent key). Each flow runs in a
// fresh profile. Point it at `pnpm dev` or a preview stage, never prod.
import { withChrome, type Tab } from "./cdp.ts";

const [base, ...only] = process.argv.slice(2);
if (!base) throw new Error("usage: pnpm flows <url> [flow ...]");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Size = { w: number; h: number; phone?: boolean };
const PHONE: Size = { w: 390, h: 844, phone: true };
const DESKTOP: Size = { w: 1440, h: 900 };
const WIDE: Size = { w: 2560, h: 1440 };

/** One tab with the helpers every flow needs. Expressions run in the page and must be JSON-serialisable. */
async function page(tab: Tab, size: Size, path: string) {
  const errors: string[] = [];
  tab.on("Runtime.exceptionThrown", (p) => errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).slice(0, 300)));
  tab.on("Runtime.consoleAPICalled", (p) => p.type === "error" && errors.push(p.args?.map((a: { value?: unknown; description?: string }) => a.value ?? a.description).join(" ").slice(0, 300)));
  await tab.send("Runtime.enable");
  await tab.send("Page.enable");
  await tab.send("Emulation.setDeviceMetricsOverride", { width: size.w, height: size.h, deviceScaleFactor: 1, mobile: !!size.phone });
  if (size.phone) await tab.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const js = async <T = unknown>(expression: string): Promise<T> => {
    const r = await tab.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`${expression.slice(0, 80)}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value as T;
  };
  const until = async (expression: string, what: string, ms = 8000) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await js(expression).catch(() => false)) return;
    throw new Error(`timed out waiting for ${what}`);
  };
  const center = async (selector: string) => {
    // Scrolls only when the element is off screen, as a person would.
    await js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}), r = e?.getBoundingClientRect(); if (r && (r.top < 56 || r.bottom > innerHeight)) e.scrollIntoView({ block: "center" }); })()`);
    // Waits for it to stop moving: a press on a sheet still sliding in lands on its backdrop and closes it.
    const at = () => js<{ x: number; y: number } | null>(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    for (let i = 0, last = await at(); i < 30; i++) {
      await sleep(80);
      const box = await at();
      if (!box) break;
      if (last && box.x === last.x && box.y === last.y) return box;
      last = box;
    }
    throw new Error(`no settled element ${selector}`);
  };
  const mouse = (type: string, x: number, y: number, extra: object = {}) => tab.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });
  const clickAt = async ({ x, y }: { x: number; y: number }) => (await mouse("mouseMoved", x, y), await mouse("mousePressed", x, y), await mouse("mouseReleased", x, y));
  const click = async (selector: string) => clickAt(await center(selector));
  const key = async (key: string, code = key, modifiers = 0) => {
    const vk = { Tab: 9, Enter: 13, Escape: 27, ArrowLeft: 37, ArrowRight: 39, k: 75 }[key] ?? 0;
    // Enter needs its text to activate the focused link or button.
    await tab.send("Input.dispatchKeyEvent", { type: key === "Enter" ? "keyDown" : "rawKeyDown", key, code, modifiers, windowsVirtualKeyCode: vk, ...(key === "Enter" && { text: "\r" }) });
    await tab.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode: vk });
  };
  // Load, then a moment for islands to hydrate.
  const go = async (p: string) => (await tab.send("Page.navigate", { url: base + p }), await until(`document.readyState === "complete"`, "load"), await sleep(1200));
  await go(path);
  return { js, until, click, clickAt, center, key, mouse, go, errors, back: () => js("history.back()"), forward: () => js("history.forward()") };
}
type P = Awaited<ReturnType<typeof page>>;

const expect = (ok: unknown, what: string) => {
  if (!ok) throw new Error(what);
};
const CARD = '[data-sheet-host] a[href^="/browse/"]';
// The first library card wholly on screen, marked so a click can find it.
const ON_SCREEN = "[data-flow-card]";
const markCard = (p: P) => p.js(`(() => { document.querySelector("${ON_SCREEN}")?.removeAttribute("data-flow-card"); const a = [...document.querySelectorAll('${CARD}')].find((a) => { const r = a.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight - 80; }); a.dataset.flowCard = ""; return a.pathname; })()`);
const SHEET = '[role=dialog][aria-label=Library]';
const sheetReady = (p: P) => p.until(`document.querySelector('${SHEET} iframe')?.contentDocument?.querySelector("[data-detail]")`, "the sheet's page");
const openSheet = async (p: P) => (await markCard(p), await p.click(ON_SCREEN), await sheetReady(p));
const closed = (p: P, what: string) => p.until(`!document.querySelector('${SHEET}') && !document.documentElement.hasAttribute("data-sheet") && location.pathname === "/browse"`, what);
const noSideScroll = async (p: P) => expect(await p.js("document.documentElement.scrollWidth <= innerWidth"), "the page scrolls sideways");
// Scrolls the window to y and waits for the end-of-list loader to settle there.
const scrollTo = async (p: P, y: number) => {
  for (let i = 0; i < 8 && (await p.js<number>("scrollY")) < y - 5; i++) await p.js(`scrollTo({ top: ${y}, behavior: "instant" })`), await sleep(400);
  return p.js<number>("scrollY");
};

const flows: Record<string, [Size, string, (p: P) => Promise<void>][]> = {
  // The bug that started this: wide screens left the folded job list far from the rail, and the sheet beside it.
  "sheet-layout": [DESKTOP, WIDE].map((s) => [s, "/browse", async (p) => {
    const rail = await p.js<number>(`document.querySelector("main").getBoundingClientRect().left + parseFloat(getComputedStyle(document.querySelector("main")).paddingLeft)`);
    expect(Math.abs((await p.js<number>(`document.querySelector("aside[aria-label=Jobs]").getBoundingClientRect().left`)) - rail) < 2, "the job list is not against the nav rail");
    await openSheet(p);
    const r = await p.js<{ aside: number; sheet: number; right: number }>(`(() => { const a = document.querySelector("aside[aria-label=Jobs]").getBoundingClientRect(), s = document.querySelector('${SHEET}').getBoundingClientRect(); return { aside: a.left, sheet: s.left - a.right, right: s.right }; })()`);
    expect(Math.abs(r.aside - rail) < 2, `folded, the job list sits ${r.aside - rail}px from the nav rail`);
    expect(r.sheet < 40, `the sheet starts ${r.sheet}px after the folded job list`);
    expect(r.right <= s.w, "the sheet is wider than the window");
    await noSideScroll(p);
  }]),
  "sheet-close": [[DESKTOP, "/browse", async (p) => {
    await scrollTo(p, 1200);
    const y = await p.js<number>("scrollY");
    for (const [how, close] of [
      ["×", () => p.click(`${SHEET} button[aria-label=Close]`)],
      ["Esc", () => p.key("Escape")],
      ["the backdrop", () => p.clickAt({ x: DESKTOP.w - 30, y: DESKTOP.h / 2 })], // the strip right of the sheet
      ["Back", () => p.back()],
    ] as const) {
      await openSheet(p);
      expect((await p.js<string>("location.pathname")).startsWith("/browse/"), "the URL does not follow the sheet");
      await close();
      await closed(p, `${how} to close the sheet`);
      expect(Math.abs((await p.js<number>("scrollY")) - y) < 4, `${how} lost the grid's scroll`);
    }
    await p.forward();
    await p.until(`!!document.querySelector('${SHEET}')`, "Forward to reopen the sheet");
  }]],
  "sheet-inside": [[DESKTOP, "/browse", async (p) => {
    await openSheet(p);
    const first = await p.js<string>("location.pathname");
    await p.js(`document.querySelector('${SHEET} iframe').contentDocument.querySelector('[data-detail] a[href^="/browse/"]:not([href="${first}"])').click()`);
    await p.until(`location.pathname !== "${first}" && location.pathname.startsWith("/browse/")`, `"Try these" to load in the sheet`);
    await sheetReady(p);
    await p.click(`${SHEET} button[aria-label=Close]`);
    await closed(p, "× after Try these to come back to the grid");
    // A job pressed while the sheet is open closes it and shows that job from the top.
    await openSheet(p);
    await p.click('aside[aria-label=Jobs] button:nth-of-type(5)');
    await p.until(`!document.querySelector('${SHEET}') && new URL(location.href).searchParams.has("job")`, "a job to close the sheet and filter");
  }]],
  // Filters live in the URL; Back from another page brings them and the scroll back, never the footer.
  "browse-back": [DESKTOP, PHONE].map((s) => [s, "/browse", async (p) => {
    await p.go("/browse?q=react&sort=stars");
    expect(await p.js(`document.querySelector('[data-sheet-host] input[type=search]').value === "react"`), "?q= did not fill the search");
    const y = await scrollTo(p, 5000);
    await p.go("/about");
    await p.back();
    await p.until(`location.pathname === "/browse" && location.search.includes("q=react") && location.search.includes("sort=stars")`, "Back to keep the filters");
    await sleep(800);
    const at = await p.js<{ y: number; bottom: number }>("({ y: scrollY, bottom: document.documentElement.scrollHeight - innerHeight })");
    expect(Math.abs(at.y - y) < 60, `Back put the scroll at ${at.y}, not ${y}`);
    expect(at.bottom - at.y > 400, "Back landed at the footer");
  }]),
  // Phones open the library as a page; Back returns to the same place in the grid.
  "phone-library": [[PHONE, "/browse", async (p) => {
    const y = await scrollTo(p, 7000);
    await markCard(p);
    await p.click(ON_SCREEN);
    await p.until(`location.pathname.startsWith("/browse/") && !!document.querySelector("[data-detail]")`, "the library page");
    await sleep(600);
    await p.back();
    await p.until(`location.pathname === "/browse"`, "Back to the grid");
    await sleep(1000);
    const at = await p.js<number>("scrollY");
    expect(Math.abs(at - y) < 60, `Back put the scroll at ${at}, not ${y}`);
  }]],
  // Desktop detail pages scroll inside their panels; reaching a panel's end must not move the page into the footer.
  "detail-panels": [[DESKTOP, "/browse/ark-ui", async (p) => {
    const over = await p.center("[data-detail] > section");
    for (let i = 0; i < 25; i++) await p.mouse("mouseWheel", over.x, over.y, { deltaX: 0, deltaY: 600 });
    await sleep(500);
    expect((await p.js<number>("scrollY")) === 0, "the left column scrolled the page");
  }], [DESKTOP, "/browse/react-aria", async (p) => {
    await p.until(`[...document.querySelectorAll("[data-detail] img")].some((i) => i.src.includes("/shots/full/") && i.complete)`, "the full-page capture");
    const box = await p.js<{ x: number; y: number }>(`(() => { const r = [...document.querySelectorAll("[data-detail] img")].find((i) => i.src.includes("/shots/full/")).getBoundingClientRect(); return { x: r.x + r.width / 2, y: Math.min(r.y + 200, innerHeight - 100) }; })()`);
    for (let i = 0; i < 25; i++) await p.mouse("mouseWheel", box.x, box.y, { deltaX: 0, deltaY: 600 });
    await sleep(500);
    expect((await p.js<number>("scrollY")) === 0, "the full-page capture scrolled the page");
  }]],
  // Like and skip by button, key and drag, then save the liked libraries as hearts (signed out: this browser).
  survey: [PHONE, DESKTOP].map((s) => [s, "/", async (p) => {
    await p.until(`!document.getElementById("taste")?.hidden`, "the taste banner");
    await p.click("#taste [data-start]");
    await p.until(`!!document.querySelector('[aria-label="Cards done"]')`, "the survey deck");
    const done = () => p.js<number>(`+document.querySelector('[aria-label="Cards done"]')?.getAttribute("aria-valuenow")`);
    const step = async (how: string, act: () => Promise<unknown>) => {
      const n = await done();
      await act();
      await p.until(`+document.querySelector('[aria-label="Cards done"]')?.getAttribute("aria-valuenow") === ${n + 1} || !document.querySelector('[aria-label="Cards done"]')`, `${how} to decide a card`);
      await sleep(150);
    };
    const drag = async (dx: number) => {
      const c = await p.center('[aria-label="Cards done"] + div > div:last-child');
      await p.mouse("mouseMoved", c.x, c.y);
      await p.mouse("mousePressed", c.x, c.y);
      for (let i = 1; i <= 10; i++) await p.mouse("mouseMoved", c.x + (dx * i) / 10, c.y, { buttons: 1 }), await sleep(16);
      await p.mouse("mouseReleased", c.x + dx, c.y);
    };
    await step("Like", () => p.click('button[aria-label="Like"]'));
    await step("Skip", () => p.click('button[aria-label="Skip"]'));
    await step("→", () => p.key("ArrowRight"));
    await step("←", () => p.key("ArrowLeft"));
    await step("a drag right", () => drag(180));
    await step("a drag left", () => drag(-180));
    while (await p.js(`!!document.querySelector('[aria-label="Cards done"]')`)) await step("Like", () => p.click('button[aria-label="Like"]'));
    await p.until(`[...document.querySelectorAll("button")].some((b) => b.textContent === "Save to my hearts")`, "the result's Save to my hearts");
    await p.js(`[...document.querySelectorAll("button")].find((b) => b.textContent === "Save to my hearts").click()`);
    await p.until(`JSON.parse(localStorage.getItem("tastebase:saved") || "[]").length > 0`, "the liked libraries to be hearted");
  }]),
  // Signed out: the heart keeps the library in this browser; hide and add to folder ask to sign in.
  "card-buttons": [PHONE, DESKTOP].map((s) => [s, "/browse", async (p) => {
    const id = await p.js<string>(`document.querySelector('${CARD}').pathname.slice(8)`);
    await p.click(`button[aria-label^="Save "]`);
    await p.until(`JSON.parse(localStorage.getItem("tastebase:saved") || "[]").includes("${id}")`, "the heart to save");
    for (const button of ['button[aria-label$=" to a folder"]', 'button[aria-label^="Hide "]']) {
      await p.go("/browse/ark-ui"); // "Try these" cards carry all three
      await p.until(`!!document.querySelector('${button}')`, `${button} to hydrate`);
      await p.click(button);
      await p.until(`[...document.querySelectorAll("[role=dialog] h2")].some((h) => h.textContent === "Sign in")`, `${button} to open sign in`);
      await p.key("Escape");
    }
  }]),
  // Leaving a page stops its unfinished screenshots (lib/prefetch.ts); a navigation overtaken by an in-page #link
  // keeps the page, so they must come back.
  "cancelled-nav": [[DESKTOP, "/browse", async (p) => {
    await p.js(`(() => { for (const [id, href] of [["flow-go", "/atlas"], ["flow-stay", "#dir-title"]]) { const a = document.createElement("a"); a.id = id; a.href = href; document.querySelector("main").append(a); } document.getElementById("flow-go").click(); })()`);
    await sleep(20);
    await p.js(`document.getElementById("flow-stay").click()`);
    await sleep(1500);
    const blank = await p.js<number>(`[...document.querySelectorAll("main img")].filter((i) => i.src.startsWith("data:")).length`);
    expect(blank === 0, `${blank} screenshots stayed blank after a cancelled navigation`);
  }]],
  // ⌘K opens the palette from any page; Esc closes it. Phones get there from the tab bar.
  palette: [[DESKTOP, "/about", async (p) => {
    await p.key("k", "KeyK", 4);
    await p.until(`!!document.querySelector("[cmdk-input]")`, "⌘K to open the palette");
    await p.key("Escape");
    await p.until(`!document.querySelector("[cmdk-input]")`, "Esc to close the palette");
  }], [PHONE, "/about", async (p) => {
    await p.click('nav[data-shell="tabbar"] a[href="/browse"]');
    await p.until(`location.pathname === "/browse"`, "the tab bar to reach /browse");
    await noSideScroll(p);
  }]],
  // A tab left open across a deploy: a navigation into another build's page loads it whole (lib/prefetch.ts), so the
  // old page's scripts never meet the new page. The build is faked by rewriting this page's id.
  // Back lands on a #hash URL, which a plain same-URL assignment would only scroll to.
  "new-build": [[DESKTOP, "/about#main", async (p) => {
    const go = (href: string) => p.js(`(() => { window.flowMark = 1; const a = document.createElement("a"); a.href = "${href}"; document.querySelector("main").append(a); a.click(); })()`);
    const old = () => p.js(`document.querySelector('meta[name="tb-build"]').content = "old"`);
    await go("/terms");
    await p.until(`location.pathname === "/terms"`, "a client navigation");
    expect(await p.js("window.flowMark === 1"), "a navigation within one build loaded the page whole");
    await old(); // Back, within this document: the router's traverse
    await p.js("window.flowMark = 1");
    await p.back();
    await p.until(`location.pathname === "/about" && document.readyState === "complete"`, "Back from an old build");
    await sleep(500);
    expect(await p.js("window.flowMark === undefined"), "Back from an old build swapped the page instead of loading it");
    await old();
    await go("/terms");
    await p.until(`location.pathname === "/terms" && document.readyState === "complete"`, "the navigation from an old build");
    await sleep(500);
    expect(await p.js("window.flowMark === undefined"), "a navigation from an old build swapped the page instead of loading it");
  }]],
  // Keyboard only: the skip link comes first, and the library and sign-in sheets take focus and give it back.
  keyboard: [[DESKTOP, "/browse", async (p) => {
    const focused = () => p.js<string>(`(document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "").trim()`);
    await p.key("Tab");
    expect((await focused()) === "Skip to content", `the first Tab lands on "${await focused()}", not the skip link`);
    const href = await markCard(p);
    await p.js(`document.querySelector("${ON_SCREEN}").focus()`);
    await p.key("Enter");
    await sheetReady(p);
    await p.key("Escape");
    await closed(p, "Esc to close the sheet");
    expect(await p.js(`document.activeElement?.pathname === "${href}"`), `closing the sheet left focus on "${await focused()}", not the card`);
    // Enter on a job while the sheet is open closes it and filters, like a press does.
    await p.js(`document.querySelector("${ON_SCREEN}").focus()`);
    await p.key("Enter");
    await sheetReady(p);
    await p.js(`document.querySelector("aside[aria-label=Jobs] button:nth-of-type(5)").focus()`);
    await p.key("Enter");
    await p.until(`!document.querySelector('${SHEET}') && location.pathname === "/browse" && new URL(location.href).searchParams.has("job")`, "Enter on a job to close the sheet and filter");
    await p.js(`document.querySelector('button[aria-label="Sign in"]').focus()`);
    await p.key("Enter");
    await p.until(`!!document.activeElement?.closest("[role=dialog]")`, "the sign-in sheet to take focus");
    await p.key("Escape");
    await p.until(`document.activeElement?.getAttribute("aria-label") === "Sign in"`, "focus back on Sign in");
  }]],
  // Signed in. Only `pnpm dev` has email sign-up (lib/auth.ts), so only there.
  ...(/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(base) && {
    "signed-in": [[DESKTOP, "/browse/ark-ui", async (p) => {
      const me = <T>(field: string) => p.js<T>(`fetch("/api/me").then((r) => r.json()).then((m) => m.${field})`);
      const up = await p.js<number>(`fetch("/api/auth/sign-up/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "flows-" + Date.now() + "@example.test", password: "flows-password-1", name: "Flows" }) }).then((r) => r.status)`);
      if (up === 404) return console.log("      signed-in: skipped, this .env has no sign-in provider"); // auth() is off without one
      expect(up === 200, `sign-up answered ${up}`);
      await p.js(`localStorage.setItem("tastebase:account", "1")`); // what signIn() sets before the provider's page
      await p.go("/browse/ark-ui"); // "Try these" cards carry heart, folder and hide
      await p.until(`!!document.querySelector('button[aria-label^="Account: "]')`, "the account button");
      await p.click('button[aria-label^="Save "]');
      await p.until(`fetch("/api/me").then((r) => r.json()).then((m) => m.saved.length > 0)`, "the heart to reach the account");
      await p.click('button[aria-label$=" to a folder"]');
      await p.until(`!!document.querySelector('input[aria-label="New folder name"]')`, "the folder picker");
      await p.js(`(() => { const i = document.querySelector('input[aria-label="New folder name"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "Flows"); i.dispatchEvent(new Event("input", { bubbles: true })); [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Create").click(); })()`);
      await p.until(`fetch("/api/me").then((r) => r.json()).then((m) => m.folders.some((f) => f.name === "Flows" && f.libs.length))`, "a new folder holding the library");
      await p.key("Escape");
      await p.until(`!document.querySelector('input[aria-label="New folder name"]')`, "the folder picker to close");
      await p.click('button[aria-label^="Hide "]');
      await p.until(`fetch("/api/me").then((r) => r.json()).then((m) => m.hidden.length > 0)`, "hiding to reach the account");
      await p.click('button[aria-label^="Account: "]');
      await p.until(`[...document.querySelectorAll("[role=dialog] button")].some((b) => b.textContent.includes("Agent key"))`, "the account sheet");
      await p.js(`[...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.includes("Agent key")).click()`);
      await p.until(`[...document.querySelectorAll("[role=dialog] button")].some((b) => b.textContent === "Make a key")`, "the agent key view");
      await p.js(`[...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent === "Make a key").click()`);
      await p.until(`[...document.querySelectorAll("[role=dialog] code")].some((c) => c.textContent.startsWith("tb_sk_"))`, "the new key");
      const mcp = await p.js<number>(`fetch("/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: "Bearer " + [...document.querySelectorAll("[role=dialog] code")].find((c) => c.textContent.startsWith("tb_sk_")).textContent }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }).then((r) => r.status)`);
      expect(mcp === 200, `/mcp answered the new key with ${mcp}`);
      expect((await me<string | null>("key"))?.length === 4, "the account does not know its key");
    }]],
  }),
};

let failed = 0;
await withChrome(async (openTab) => {
  for (const [name, runs] of Object.entries(flows)) {
    if (only.length && !only.includes(name)) continue;
    for (const [size, path, run] of runs) {
      const label = `${name} @${size.w}`;
      const tab = await openTab();
      const t = Date.now();
      try {
        const p = await page(tab, size, path);
        await run(p);
        if (p.errors.length) throw new Error(`console: ${p.errors[0]}`);
        console.log(`ok    ${label} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
      } catch (e) {
        failed++;
        console.log(`FAIL  ${label}: ${(e as Error).message}`);
      } finally {
        await tab.close();
      }
    }
  }
});
console.log(failed ? `${failed} failed` : "all flows passed");
process.exit(failed ? 1 : 0);
