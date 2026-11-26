// Shared by `tastebase login` (src/login.ts), /connect and the Worker that checks it (POST /api/login), so it imports nothing.
const CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: the code is read off one screen and checked on another

/** A login attempt's handle: the SHA-256 of the terminal's secret, in hex. The browser approves it, and only the secret
 *  claims it, so seeing the link or the code claims nothing. */
export async function loginId(secret: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The short code shown in the terminal and on /connect, for a person to check they match. Display only. */
export function loginCode(id: string) {
  const c = Array.from({ length: 8 }, (_, i) => CODE[parseInt(id.slice(i * 2, i * 2 + 2), 16) % CODE.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** A login id from untrusted input (64 hex characters), or undefined. */
export const idFrom = (v: unknown) => (typeof v === "string" && /^[0-9a-f]{64}$/.test(v) ? v : undefined);
