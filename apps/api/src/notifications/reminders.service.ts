import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { AppConfigService } from "../config/app-config.service";
import { EMAIL_SENDER, type EmailSender } from "./email/email-sender";
import { REMINDABLE_STATUSES, REMINDERS_QUEUE, SEND_DIGEST_JOB, type SendDigestJobData } from "./notifications.constants";
import { effectiveReminderSettings } from "../settings/effective-settings";
import { RemindersRepository, type DigestUser, type ReminderCandidate } from "./reminders.repository";
import { localDate, localHour } from "./time-zone";
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

  /**
   * Run by the hourly scan: queues one digest for each user whose local time
   * is REMINDER_HOUR and who has something to be reminded about.
   */
  async enqueueDigests(now: Date): Promise<number> {
    const jobs: { userId: string; digestDate: string }[] = [];
    for (const user of await this.repository.findDigestUsers()) {
      const { timeZone, staleDays } = this.settingsFor(user);
      if (localHour(now, timeZone) !== this.config.reminderHour) continue;
      if ((await this.findDue(now, user.id, staleDays)).length === 0) continue;
      jobs.push({ userId: user.id, digestDate: localDate(now, timeZone) });
    }

    await this.queue.addBulk(
      jobs.map((data) => ({
        name: SEND_DIGEST_JOB,
        data,
        opts: {
          // Collapses a duplicate scan on the same day while the job is still queued.
          // BullMQ rejects ":" in custom ids.
          jobId: `digest-${data.userId}-${data.digestDate}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      })),
    );
    this.logger.log(`Queued ${jobs.length} reminder digest(s)`);
    return jobs.length;
  }

  /**
   * Re-checks the user's settings and what's due (either may have changed
   * while the job waited), sends one email, then records the reminders. If
   * recording fails the job retries, and the idempotency key stops a second email.
   */
  async sendDigest(job: SendDigestJobData, now: Date): Promise<{ sent: boolean }> {
    const [user] = await this.repository.findDigestUsers(job.userId);
    if (!user) {
      return { sent: false };
    }
    const due = await this.findDue(now, user.id, this.settingsFor(user).staleDays);
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

  private settingsFor(user: DigestUser): { timeZone: string; staleDays: number } {
    return effectiveReminderSettings(user, {
      timeZone: this.config.reminderTz,
      staleDays: this.config.reminderStaleDays,
    });
  }

  private async findDue(now: Date, userId: string, staleDays: number): Promise<ReminderCandidate[]> {
    const candidates = await this.repository.findCandidates({
      statuses: REMINDABLE_STATUSES,
      updatedBefore: new Date(now.getTime() - staleDays * DAY_MS),
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
