import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { AppConfigService } from "../config/app-config.service";
import { fromDateOnly, toDateOnly } from "../follow-ups/follow-up-dates";
import { effectiveTimeZone } from "../settings/effective-settings";
import { EMAIL_SENDER, type EmailSender } from "./email/email-sender";
import { FollowUpRemindersRepository, type UnremindedFollowUp } from "./follow-up-reminders.repository";
import {
  REMINDERS_QUEUE,
  SEND_FOLLOW_UP_DIGEST_JOB,
  type SendFollowUpDigestJobData,
} from "./notifications.constants";
import { buildFollowUpDigest } from "./templates/follow-up-digest";
import { localDate, localHour } from "./time-zone";

@Injectable()
export class FollowUpRemindersService {
  private readonly logger = new Logger(FollowUpRemindersService.name);

  constructor(
    private readonly repository: FollowUpRemindersRepository,
    private readonly config: AppConfigService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @InjectQueue(REMINDERS_QUEUE) private readonly queue: Queue<SendFollowUpDigestJobData>,
  ) {}

  /**
   * Run by the hourly digest scan: queues one e-mail for each user whose local
   * time is REMINDER_HOUR and who has follow-ups due that no e-mail mentioned yet.
   */
  async enqueueDue(now: Date): Promise<number> {
    const jobs: SendFollowUpDigestJobData[] = [];
    for (const user of await this.repository.findUsers()) {
      const timeZone = this.timeZoneFor(user.timeZone);
      if (localHour(now, timeZone) !== this.config.reminderHour) continue;
      const today = localDate(now, timeZone);
      if ((await this.repository.findUnreminded(user.id, fromDateOnly(today))).length === 0) continue;
      jobs.push({ userId: user.id, digestDate: today });
    }

    await this.queue.addBulk(
      jobs.map((data) => ({
        name: SEND_FOLLOW_UP_DIGEST_JOB,
        data,
        opts: {
          // Collapses a duplicate scan on the same day while the job is still queued.
          // BullMQ rejects ":" in custom ids.
          jobId: `follow-up-digest-${data.userId}-${data.digestDate}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      })),
    );
    this.logger.log(`Queued ${jobs.length} follow-up digest(s)`);
    return jobs.length;
  }

  /**
   * Re-checks the setting and what's due (either may have changed while the
   * job waited), sends, then marks the follow-ups reminded. If marking fails
   * the job retries, and the idempotency key stops a second e-mail.
   */
  async send(job: SendFollowUpDigestJobData, now: Date): Promise<{ sent: boolean }> {
    const [user] = await this.repository.findUsers(job.userId);
    if (!user) {
      return { sent: false };
    }
    const today = localDate(now, this.timeZoneFor(user.timeZone));
    const due = await this.repository.findUnreminded(user.id, fromDateOnly(today));
    if (due.length === 0) {
      return { sent: false };
    }

    const { subject, html, text } = buildFollowUpDigest({
      userName: user.name,
      today,
      followUps: due.map(toDigestFollowUp),
      webOrigin: this.config.webOrigin,
    });
    const { id } = await this.emailSender.send({
      to: user.email,
      subject,
      html,
      text,
      idempotencyKey: `follow-up-digest:${job.userId}:${job.digestDate}`,
    });
    await this.repository.markReminded(
      due.map((followUp) => followUp.id),
      now,
    );
    this.logger.log(`Sent follow-up digest ${id} to user ${job.userId} (${due.length} follow-up(s))`);
    return { sent: true };
  }

  private timeZoneFor(timeZone: string | null): string {
    return effectiveTimeZone(timeZone, this.config.reminderTz);
  }
}

function toDigestFollowUp(followUp: UnremindedFollowUp) {
  return {
    dueDate: toDateOnly(followUp.dueDate),
    note: followUp.note,
    contactName: followUp.contact && !followUp.contact.deletedAt ? followUp.contact.name : null,
    applicationId: followUp.application.id,
    companyName: followUp.application.company.name,
    position: followUp.application.position,
  };
}
