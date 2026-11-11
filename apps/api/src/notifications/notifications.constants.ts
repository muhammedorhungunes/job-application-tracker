import type { ApplicationStatus } from "@prisma/client";
import { z } from "zod";

export const REMINDERS_QUEUE = "notifications-reminders";
export const SCAN_JOB = "scan";
export const SEND_DIGEST_JOB = "send-digest";
// The id predates the hourly scan; kept so the upsert replaces the old daily schedule instead of adding a second one.
export const DAILY_SCAN_SCHEDULER_ID = "daily-reminder-scan";
export const DIGEST_SCAN_PATTERN = "0 * * * *";

export const INTERVIEW_SCAN_JOB = "interview-scan";
export const SEND_INTERVIEW_REMINDER_JOB = "send-interview-reminder";
export const INTERVIEW_SCAN_SCHEDULER_ID = "interview-reminder-scan";

/** Statuses still waiting on the company; offers and closed applications aren't nagged about. */
export const REMINDABLE_STATUSES = ["APPLIED", "INTERVIEWING"] as const satisfies readonly ApplicationStatus[];

export const SendDigestJobDataSchema = z.object({
  userId: z.string().min(1),
  /** The user's local YYYY-MM-DD when the scan queued it; keys the email's idempotency. */
  digestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type SendDigestJobData = z.infer<typeof SendDigestJobDataSchema>;

export const SendInterviewReminderJobDataSchema = z.object({
  interviewId: z.string().min(1),
  /** The interview time this job is about; a reschedule makes the job obsolete. */
  scheduledAt: z.string().datetime(),
});
export type SendInterviewReminderJobData = z.infer<typeof SendInterviewReminderJobDataSchema>;
