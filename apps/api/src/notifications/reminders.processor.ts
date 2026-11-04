import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { UnrecoverableError, type Job } from "bullmq";
import { EmailSendError } from "./email/email-sender";
import { REMINDERS_QUEUE, SCAN_JOB, SEND_DIGEST_JOB, SendDigestJobDataSchema } from "./notifications.constants";
import { RemindersService } from "./reminders.service";

@Processor(REMINDERS_QUEUE)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(private readonly remindersService: RemindersService) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    switch (job.name) {
      case SCAN_JOB:
        await this.remindersService.enqueueDigests(new Date());
        return;
      case SEND_DIGEST_JOB:
        await this.sendDigest(job);
        return;
      default:
        this.logger.warn(`Unknown job "${job.name}" on ${REMINDERS_QUEUE}, skipping`);
    }
  }

  private async sendDigest(job: Job<unknown>): Promise<void> {
    const data = SendDigestJobDataSchema.safeParse(job.data);
    if (!data.success) {
      throw new UnrecoverableError(`Invalid ${SEND_DIGEST_JOB} job data: ${data.error.message}`);
    }
    try {
      await this.remindersService.sendDigest(data.data, new Date());
    } catch (error) {
      this.logger.warn(
        `Reminder digest for user ${data.data.userId} attempt ${job.attemptsMade + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // UnrecoverableError tells BullMQ to skip the remaining attempts.
      if (error instanceof EmailSendError && !error.retryable) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }
}
