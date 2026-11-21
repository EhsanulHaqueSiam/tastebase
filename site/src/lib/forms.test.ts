import assert from "node:assert/strict";
import { test } from "node:test";
import { mailFor, rateKey, schemas } from "./forms.ts";

test("forms accept only web links, real emails and known categories", () => {
  const ok = { name: "Figma", url: "https://figma.com", category: "tools", email: "a@b.co", reason: "Design tool" };
  assert.equal(schemas.submit.safeParse(ok).success, true);
  for (const bad of [{ url: "javascript:alert(1)" }, { url: "ftp://x.com" }, { email: "nope" }, { category: "weapons" }, { reason: " " }])
    assert.equal(schemas.submit.safeParse({ ...ok, ...bad }).success, false, JSON.stringify(bad));
  assert.equal(schemas.feedback.safeParse({ email: "", message: "Love it" }).success, true);
});

test("the admin email cannot be given extra headers, and rate keys roll over each hour", () => {
  assert.equal(mailFor("sponsor", { company: "Acme\r\nBcc: x@y.z", message: "hi" }).subject, "[tastebase] Sponsor inquiry: Acme Bcc: x@y.z");
  const t = Date.UTC(2026, 10, 21, 10, 59);
  assert.equal(rateKey("1.2.3.4", t), rateKey("1.2.3.4", t + 30_000));
  assert.notEqual(rateKey("1.2.3.4", t), rateKey("1.2.3.4", t + 60_000));
});
