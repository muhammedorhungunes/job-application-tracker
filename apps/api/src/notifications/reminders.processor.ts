import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { UnrecoverableError, type Job } from "bullmq";
import type { z } from "zod";
import { EmailSendError } from "./email/email-sender";
import { InterviewRemindersService } from "./interview-reminders.service";
import {
  INTERVIEW_SCAN_JOB,
  REMINDERS_QUEUE,
  SCAN_JOB,
  SEND_DIGEST_JOB,
  SEND_INTERVIEW_REMINDER_JOB,
  SendDigestJobDataSchema,
  SendInterviewReminderJobDataSchema,
} from "./notifications.constants";
import { RemindersService } from "./reminders.service";

@Processor(REMINDERS_QUEUE)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private readonly remindersService: RemindersService,
    private readonly interviewRemindersService: InterviewRemindersService,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    switch (job.name) {
      case SCAN_JOB:
        await this.remindersService.enqueueDigests(new Date());
        return;
      case SEND_DIGEST_JOB:
        await this.runSend(job, SendDigestJobDataSchema, (data) => this.remindersService.sendDigest(data, new Date()));
        return;
      case INTERVIEW_SCAN_JOB:
        await this.interviewRemindersService.enqueueDue(new Date());
        return;
      case SEND_INTERVIEW_REMINDER_JOB:
        await this.runSend(job, SendInterviewReminderJobDataSchema, (data) =>
          this.interviewRemindersService.send(data, new Date()),
        );
        return;
      default:
        this.logger.warn(`Unknown job "${job.name}" on ${REMINDERS_QUEUE}, skipping`);
    }
  }

  /** Validates job data and maps e-mail errors onto BullMQ's retry semantics. */
  private async runSend<T>(job: Job<unknown>, schema: z.ZodType<T>, send: (data: T) => Promise<unknown>): Promise<void> {
    const data = schema.safeParse(job.data);
    if (!data.success) {
      throw new UnrecoverableError(`Invalid ${job.name} job data: ${data.error.message}`);
    }
    try {
      await send(data.data);
    } catch (error) {
      this.logger.warn(
        `${job.name} job ${job.id ?? ""} attempt ${job.attemptsMade + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // UnrecoverableError tells BullMQ to skip the remaining attempts.
      if (error instanceof EmailSendError && !error.retryable) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }
}
