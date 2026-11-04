import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { AppConfigService } from "../config/app-config.service";
import { EMAIL_SENDER, type EmailSender } from "./email/email-sender";
import { REMINDABLE_STATUSES, REMINDERS_QUEUE, SEND_DIGEST_JOB, type SendDigestJobData } from "./notifications.constants";
import { RemindersRepository, type ReminderCandidate } from "./reminders.repository";
import { buildReminderDigest } from "./templates/reminder-digest";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly repository: RemindersRepository,
    private readonly config: AppConfigService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @InjectQueue(REMINDERS_QUEUE) private readonly queue: Queue<SendDigestJobData>,
  ) {}

  /** Run by the daily scan: queues one digest per user with something to remind about. */
  async enqueueDigests(now: Date): Promise<number> {
    const userIds = [...new Set((await this.findDue(now)).map((c) => c.userId))];
    const digestDate = now.toISOString().slice(0, 10);
    await this.queue.addBulk(
      userIds.map((userId) => ({
        name: SEND_DIGEST_JOB,
        data: { userId, digestDate },
        opts: {
          // Collapses a duplicate scan on the same day while the job is still queued.
          // BullMQ rejects ":" in custom ids.
          jobId: `digest-${userId}-${digestDate}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      })),
    );
    this.logger.log(`Queued ${userIds.length} reminder digest(s) for ${digestDate}`);
    return userIds.length;
  }

  /**
   * Re-checks what's due (an application may have been updated while the job
   * waited), sends one email, then records the reminders. If recording fails
   * the job retries, and the idempotency key stops a second email.
   */
  async sendDigest(job: SendDigestJobData, now: Date): Promise<{ sent: boolean }> {
    const due = await this.findDue(now, job.userId);
    if (due.length === 0) {
      return { sent: false };
    }

    const { email, name } = due[0]!.user;
    const { subject, html, text } = buildReminderDigest({
      userName: name,
      applications: due.map((c) => ({
        id: c.id,
        companyName: c.company.name,
        position: c.position,
        status: c.status,
        updatedAt: c.updatedAt,
      })),
      webOrigin: this.config.webOrigin,
      now,
    });

    const { id } = await this.emailSender.send({
      to: email,
      subject,
      html,
      text,
      idempotencyKey: `reminder-digest:${job.userId}:${job.digestDate}`,
    });
    await this.repository.recordReminders(
      due.map((c) => c.id),
      now,
    );
    this.logger.log(`Sent reminder digest ${id} to user ${job.userId} (${due.length} application(s))`);
    return { sent: true };
  }

  private async findDue(now: Date, userId?: string): Promise<ReminderCandidate[]> {
    const candidates = await this.repository.findCandidates({
      statuses: REMINDABLE_STATUSES,
      updatedBefore: new Date(now.getTime() - this.config.reminderStaleDays * DAY_MS),
      userId,
    });
    return candidates.filter(isDue);
  }
}

/** Reminded once per period of silence: a reminder counts until the application is updated again. */
export function isDue(candidate: ReminderCandidate): boolean {
  const lastReminder = candidate.reminders[0];
  return !lastReminder || lastReminder.sentAt < candidate.updatedAt;
}
