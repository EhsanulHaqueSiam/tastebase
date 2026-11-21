// The three public forms (submit a tool, feedback, sponsor): what each asks, how the server validates it, and the plain
// text email the admin gets. Shared by the form island (field names, categories) and /api/forms (schemas, email).
import { z } from "astro/zod";
import { categories } from "./categories.ts";

export const FORMS = { submit: "Submit a tool", feedback: "Feedback", sponsor: "Sponsor inquiry" } as const;
export type FormId = keyof typeof FORMS;

/** Submissions per IP per hour, counted only after Turnstile passes. */
export const RATE_LIMIT = 5;
export const rateKey = (ip: string, now = Date.now()) => `forms:${ip}:${Math.floor(now / 3_600_000)}`;

const text = (max: number) => z.string().trim().min(1, "Required").max(max, `Keep it under ${max} characters`);
const email = z.email("Enter a valid email").max(200);
// z.url() also accepts javascript: and other schemes; only web links are useful here.
const web = z.url({ protocol: /^https?$/, error: "Enter a link that starts with https://" }).max(500);

export const schemas = {
  submit: z.object({ name: text(100), url: web, category: z.enum([...categories.map((c) => c.slug), "library"]), email, reason: text(2000) }),
  feedback: z.object({ email: email.optional().or(z.literal("")), message: text(4000) }),
  sponsor: z.object({ company: text(100), url: web, email, message: text(2000) }),
} satisfies Record<FormId, z.ZodType>;

export const request = z.object({ form: z.enum(Object.keys(FORMS) as [FormId, ...FormId[]]), token: z.string().min(1, "Complete the check first").max(4096), fields: z.record(z.string(), z.string()) });

/** The admin's email: a subject without line breaks (header injection) and the fields as plain text. */
export function mailFor(form: FormId, fields: Record<string, string>) {
  const lead = fields.name ?? fields.company ?? "";
  const subject = `[tastebase] ${FORMS[form]}${lead ? `: ${lead}` : ""}`.replace(/[\r\n]+/g, " ").slice(0, 200);
  const body = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `${k}:\n${v}`).join("\n\n");
  return { subject, text: `${body}\n\n(sent from the ${FORMS[form].toLowerCase()} form)` };
}
