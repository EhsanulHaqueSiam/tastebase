// What a page downloads, grouped and sorted by size: `node --experimental-strip-types scripts/requests.ts <url> [width]`.
// A quick look behind a heavy result in `pnpm bench`.
import { withChrome } from "../src/cdp.ts";

const [url, width = "1440"] = process.argv.slice(2);
if (!url) throw new Error("usage: requests.ts <url> [width]");
const rows: { url: string; type: string; bytes: number }[] = [];
await withChrome(async (openTab) => {
  const tab = await openTab();
  const meta = new Map<string, { url: string; type: string }>();
  let inflight = 0;
  tab.on("Network.requestWillBeSent", (p) => (inflight++, meta.set(p.requestId, { url: p.request.url, type: p.type ?? "Other" })));
  tab.on("Network.loadingFinished", (p) => { inflight--; const m = meta.get(p.requestId); if (m) rows.push({ ...m, bytes: p.encodedDataLength }); });
  tab.on("Network.loadingFailed", () => inflight--);
  await tab.send("Network.enable");
  await tab.send("Network.setCacheDisabled", { cacheDisabled: true });
  await tab.send("Emulation.setDeviceMetricsOverride", { width: Number(width), height: Number(width) < 600 ? 844 : 900, deviceScaleFactor: 1, mobile: Number(width) < 600 });
  await tab.send("Page.navigate", { url });
  for (let quiet = 0; quiet < 8; await new Promise((r) => setTimeout(r, 250))) quiet = inflight > 0 ? 0 : quiet + 1;
  await tab.close();
});
const byType = new Map<string, { n: number; bytes: number }>();
for (const r of rows) { const t = byType.get(r.type) ?? { n: 0, bytes: 0 }; t.n++; t.bytes += r.bytes; byType.set(r.type, t); }
console.log([...byType].sort((a, b) => b[1].bytes - a[1].bytes).map(([t, v]) => `${t}: ${v.n} requests, ${Math.round(v.bytes / 1024)} KB`).join("\n"));
console.log("\nlargest:");
for (const r of rows.sort((a, b) => b.bytes - a.bytes).slice(0, 15)) console.log(`${String(Math.round(r.bytes / 1024)).padStart(6)} KB  ${r.type.padEnd(10)} ${r.url.slice(0, 120)}`);
const groups = new Map<string, number>();
for (const r of rows) { const k = new URL(r.url).pathname.split("/").slice(0, 2).join("/"); groups.set(k, (groups.get(k) ?? 0) + 1); }
console.log("\nby path:", [...groups].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(", "));
