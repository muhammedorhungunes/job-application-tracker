import type { ApplicationStatus } from "@prisma/client";
import { z } from "zod";

export const REMINDERS_QUEUE = "notifications-reminders";
export const SCAN_JOB = "scan";
export const SEND_DIGEST_JOB = "send-digest";
export const DAILY_SCAN_SCHEDULER_ID = "daily-reminder-scan";

/** Statuses still waiting on the company; offers and closed applications aren't nagged about. */
export const REMINDABLE_STATUSES = ["APPLIED", "INTERVIEWING"] as const satisfies readonly ApplicationStatus[];

export const SendDigestJobDataSchema = z.object({
  userId: z.string().min(1),
  /** YYYY-MM-DD of the scan that queued it; keys the email's idempotency. */
  digestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type SendDigestJobData = z.infer<typeof SendDigestJobDataSchema>;
