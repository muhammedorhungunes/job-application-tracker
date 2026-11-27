import { z } from "zod";
import { ApplicationStatusSchema, CompanySummarySchema, DateOnlySchema } from "./application";

/** A planned follow-up for one application, as returned by the API. */
export const FollowUpSchema = z.object({
  id: z.string(),
  /** Calendar day (YYYY-MM-DD) in the user's time zone; there is no time of day. */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string(),
  /** Null once the contact is removed. */
  contact: z.object({ id: z.string(), name: z.string() }).nullable(),
  doneAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FollowUp = z.infer<typeof FollowUpSchema>;

/** GET /follow-ups/due: open follow-ups due today or earlier, with their application. */
export const DueFollowUpSchema = FollowUpSchema.extend({
  application: z.object({
    id: z.string(),
    position: z.string(),
    status: ApplicationStatusSchema,
    company: CompanySummarySchema,
  }),
});
export type DueFollowUp = z.infer<typeof DueFollowUpSchema>;

const note = z.string().trim().min(1).max(1000);
const contactId = z.string().trim().min(1).max(100);

export const CreateFollowUpInputSchema = z.object({
  dueDate: DateOnlySchema,
  note,
  contactId: contactId.optional(),
});
export type CreateFollowUpInput = z.infer<typeof CreateFollowUpInputSchema>;

/** PATCH input. Omitted keys are left untouched; `null` clears the contact — same convention as UpdateContactInputSchema. */
export const UpdateFollowUpInputSchema = z
  .object({
    dueDate: DateOnlySchema.optional(),
    note: note.optional(),
    contactId: contactId.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one field to update" });
export type UpdateFollowUpInput = z.infer<typeof UpdateFollowUpInputSchema>;
