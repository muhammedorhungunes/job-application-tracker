import { z } from "zod";
import { ApplicationStatusSchema } from "./application";

/** Mirrors prisma/schema.prisma's `ActivityType` enum by hand, same as ApplicationStatusValues. */
export const ActivityTypeValues = [
  "STATUS_CHANGE",
  "NOTE",
  "INTERVIEW_SCHEDULED",
  "APPLICATION_CREATED",
  "INTERVIEW_CANCELLED",
] as const;
export const ActivityTypeSchema = z.enum(ActivityTypeValues);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

/**
 * One entry of an application's timeline (GET /applications/:id/activities).
 * `fromStatus`/`toStatus` are set for STATUS_CHANGE, `toStatus` for
 * APPLICATION_CREATED. Both are null for other types, and for creation rows
 * backfilled before history was recorded (the initial status isn't known).
 */
export const ActivitySchema = z.object({
  id: z.string(),
  type: ActivityTypeSchema,
  description: z.string(),
  fromStatus: ApplicationStatusSchema.nullable(),
  toStatus: ApplicationStatusSchema.nullable(),
  createdAt: z.string().datetime(),
});
export type Activity = z.infer<typeof ActivitySchema>;

/** POST /applications/:id/notes. Notes can be added and deleted, not edited. */
export const CreateNoteInputSchema = z.object({
  text: z.string().trim().min(1).max(5000),
});
export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;
