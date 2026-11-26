// Shared by `tastebase login` (src/login.ts) and the Worker that checks it (POST /api/login), so it imports nothing.
const CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: the code is read off one screen and checked on another

/** The code a person approves in the browser for a terminal's secret: 8 characters of its SHA-256. The server works it
 *  out again from the secret, so a code alone claims nothing. */
export async function loginCode(secret: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));
  const c = Array.from(h.slice(0, 8), (b) => CODE[b % CODE.length]).join("");
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** A code as the browser may send it: XXXX-XXXX in CODE's letters, or undefined. */
export const codeFrom = (v: unknown) => (typeof v === "string" && new RegExp(`^[${CODE}]{4}-[${CODE}]{4}$`).test(v) ? v : undefined);
