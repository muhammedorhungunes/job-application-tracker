import { z } from "zod";

/** A person at the company for one application, as returned by the API. */
export const ContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Contact = z.infer<typeof ContactSchema>;

const name = z.string().trim().min(1).max(200);
const role = z.string().trim().min(1).max(200);
const email = z.string().trim().toLowerCase().email().max(320);
const phone = z.string().trim().min(1).max(50);
// Rendered as an href, so only web links: `.url()` alone accepts `javascript:`.
const linkedinUrl = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value), { message: "Must start with http:// or https://" });
const notes = z.string().trim().min(1).max(5000);

export const CreateContactInputSchema = z.object({
  name,
  role: role.optional(),
  email: email.optional(),
  phone: phone.optional(),
  linkedinUrl: linkedinUrl.optional(),
  notes: notes.optional(),
});
export type CreateContactInput = z.infer<typeof CreateContactInputSchema>;

/**
 * PATCH input. Omitted keys are left untouched; `null` clears an optional
 * field — same convention as UpdateInterviewInputSchema.
 */
export const UpdateContactInputSchema = z
  .object({
    name: name.optional(),
    role: role.nullable().optional(),
    email: email.nullable().optional(),
    phone: phone.nullable().optional(),
    linkedinUrl: linkedinUrl.nullable().optional(),
    notes: notes.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one field to update" });
export type UpdateContactInput = z.infer<typeof UpdateContactInputSchema>;
