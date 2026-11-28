// The Chrome or Chromium binary for headless runs: $CHROMIUM, else the first installed Chromium browser in its usual
// place (Chrome, Chromium, Edge, Brave), else `chromium` on the PATH. `npx tastebase` capture runs on users' machines.
import { existsSync } from "node:fs";

const { PROGRAMFILES = "C:\\Program Files", LOCALAPPDATA = "" } = process.env;
const pf86 = process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";
const candidates =
  process.platform === "darwin"
    ? ["Google Chrome", "Chromium", "Microsoft Edge", "Brave Browser"].map((n) => `/Applications/${n}.app/Contents/MacOS/${n}`)
    : process.platform === "win32"
      ? [`${PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`, `${LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`]
      : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"].flatMap((n) => [`/usr/bin/${n}`, `/snap/bin/${n}`]);

export const chromium = process.env.CHROMIUM ?? candidates.find((p) => existsSync(p)) ?? "chromium";
