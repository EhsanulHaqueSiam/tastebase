// Client-safe: tags outbound links so a site we send people to can see the visit came from us.
const SOURCE = "tastebase";

/** `url` with utm_source=tastebase, utm_medium=referral and utm_content=<where>. Leaves alone a URL that already carries
 *  a utm_source (an affiliate link) or is not http(s). */
export function withUtm(url: string, content?: string) {
  if (!URL.canParse(url)) return url;
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || u.searchParams.has("utm_source")) return url;
  u.searchParams.set("utm_source", SOURCE);
  u.searchParams.set("utm_medium", "referral");
  if (content) u.searchParams.set("utm_content", content);
  return u.toString();
}

/** Shares a page of ours (the Web Share sheet where there is one, else the clipboard), tagged so shared visits are
 *  told apart from organic ones. Resolves "copied" when it fell back to the clipboard, "shared" otherwise. */
export async function sharePage(title: string, content: string): Promise<"shared" | "copied" | "cancelled"> {
  const u = new URL(location.href);
  u.search = "";
  u.searchParams.set("utm_source", "share");
  u.searchParams.set("utm_medium", "share-button");
  u.searchParams.set("utm_content", content);
  const url = u.toString();
  try {
    if (navigator.share) {
      await navigator.share({ title: `${title} · tastebase`, text: `${title}, on tastebase`, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "cancelled"; // dismissed the share sheet, or the clipboard is blocked
  }
}
