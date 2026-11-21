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
