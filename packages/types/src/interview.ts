import { z } from "zod";
import { ApplicationStatusSchema, CompanySummarySchema } from "./application";

/** Mirrors prisma/schema.prisma's `InterviewKind` enum by hand, same as ApplicationStatusValues. */
export const InterviewKindValues = ["PHONE", "TECHNICAL", "ONSITE", "OTHER"] as const;
export const InterviewKindSchema = z.enum(InterviewKindValues);
export type InterviewKind = z.infer<typeof InterviewKindSchema>;

/** An interview as returned by the API. `scheduledAt` is a UTC ISO string; clients format it in their own zone. */
export const InterviewSchema = z.object({
  id: z.string(),
  kind: InterviewKindSchema,
  scheduledAt: z.string().datetime(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Interview = z.infer<typeof InterviewSchema>;

export const CreateInterviewInputSchema = z.object({
  kind: InterviewKindSchema,
  scheduledAt: z.string().datetime(),
  notes: z.string().trim().min(1).max(5000).optional(),
});
export type CreateInterviewInput = z.infer<typeof CreateInterviewInputSchema>;

/**
 * PATCH input. Omitted keys are left untouched; `notes: null` clears the
 * notes — same convention as UpdateApplicationInputSchema.
 */
export const UpdateInterviewInputSchema = z
  .object({
    kind: InterviewKindSchema.optional(),
    scheduledAt: z.string().datetime().optional(),
    notes: z.string().trim().min(1).max(5000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one field to update" });
export type UpdateInterviewInput = z.infer<typeof UpdateInterviewInputSchema>;

/** GET /interviews/upcoming query. `days` is the look-ahead window from now. */
export const UpcomingInterviewsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});
export type UpcomingInterviewsQuery = z.infer<typeof UpcomingInterviewsQuerySchema>;

/** An interview across all of the user's applications, with enough of the application to link to it. */
export const UpcomingInterviewSchema = InterviewSchema.extend({
  application: z.object({
    id: z.string(),
    position: z.string(),
    status: ApplicationStatusSchema,
    company: CompanySummarySchema,
  }),
});
export type UpcomingInterview = z.infer<typeof UpcomingInterviewSchema>;
