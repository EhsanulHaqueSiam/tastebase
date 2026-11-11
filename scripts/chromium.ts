// The Chrome or Chromium binary used for headless screenshots: $CHROMIUM, else Chrome on macOS, else `chromium` on the PATH.
import { existsSync } from "node:fs";

const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const chromium = process.env.CHROMIUM ?? (existsSync(mac) ? mac : "chromium");
