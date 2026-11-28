// `capture` for `npx tastebase`: the page's tokens and a screenshot from the user's own Chrome (or Edge, Chromium,
// Brave), started headless in a fresh profile for each call.
import { withChrome } from "./cdp.ts";
import { PAGE_SCRIPT, type Capture, type CaptureRunner } from "./capture.ts";

const WIDTH = 1440, HEIGHT = 900;

export const captureLocal: CaptureRunner = (url) =>
  withChrome(async (openTab) => {
    const tab = await openTab();
    await tab.send("Page.enable");
    await tab.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
    const loaded = new Promise<void>((ok) => tab.on("Page.loadEventFired", () => ok()));
    const nav = await tab.send("Page.navigate", { url });
    if (nav.errorText) return { error: nav.errorText };
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 20_000))]);
    await new Promise((r) => setTimeout(r, 1500)); // late fonts, hydration and entrance motion
    // Fonts, then entrance animations (finite ones; loops never finish), so the shot is not caught mid-fade.
    const settle = "Promise.race([Promise.all([document.fonts.ready, ...document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))]), new Promise((r) => setTimeout(r, 4000))])";
    await tab.send("Runtime.evaluate", { expression: settle, awaitPromise: true }).catch(() => {});
    const { result, exceptionDetails } = await tab.send("Runtime.evaluate", { expression: PAGE_SCRIPT, returnByValue: true, timeout: 15_000 });
    if (exceptionDetails) return { error: exceptionDetails.exception?.description ?? exceptionDetails.text };
    const { data } = await tab.send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
    return { capture: result.value as Capture, jpeg: data as string };
  }).catch((e: Error) => ({ error: `${e.message}. Install Chrome, or set CHROMIUM to a Chromium browser.` }));
