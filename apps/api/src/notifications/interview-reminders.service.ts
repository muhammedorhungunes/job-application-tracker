import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { AppConfigService } from "../config/app-config.service";
import { effectiveTimeZone } from "../settings/effective-settings";
import { EMAIL_SENDER, type EmailSender } from "./email/email-sender";
import {
  REMINDERS_QUEUE,
  SEND_INTERVIEW_REMINDER_JOB,
  type SendInterviewReminderJobData,
} from "./notifications.constants";
import { InterviewRemindersRepository } from "./interview-reminders.repository";
import { buildInterviewReminder } from "./templates/interview-reminder";

const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class InterviewRemindersService {
  private readonly logger = new Logger(InterviewRemindersService.name);

  constructor(
    private readonly repository: InterviewRemindersRepository,
    private readonly config: AppConfigService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    @InjectQueue(REMINDERS_QUEUE) private readonly queue: Queue<SendInterviewReminderJobData>,
  ) {}

  /** Run by the hourly scan: queues one e-mail per interview starting within the lead time. */
  async enqueueDue(now: Date): Promise<number> {
    const due = await this.repository.findDue(this.window(now));
    await this.queue.addBulk(
      due.map((interview) => ({
        name: SEND_INTERVIEW_REMINDER_JOB,
        data: { interviewId: interview.id, scheduledAt: interview.scheduledAt.toISOString() },
        opts: {
          // Collapses a repeat scan while the job is still queued; a reschedule
          // gets a new id. BullMQ rejects ":" in custom ids.
          jobId: `interview-reminder-${interview.id}-${interview.scheduledAt.getTime()}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      })),
    );
    this.logger.log(`Queued ${due.length} interview reminder(s)`);
    return due.length;
  }

  /**
   * Re-checks the interview (it may have been cancelled, moved or already
   * reminded while the job waited), sends, then records it. If recording
   * fails the job retries, and the idempotency key stops a second e-mail.
   */
  async send(job: SendInterviewReminderJobData, now: Date): Promise<{ sent: boolean }> {
    const [interview] = await this.repository.findDue({ ...this.window(now), interviewId: job.interviewId });
    // A reschedule after queueing is handled by the job for the new time.
    if (!interview || interview.scheduledAt.toISOString() !== job.scheduledAt) {
      return { sent: false };
    }

    const { application } = interview;
    const origin = this.config.webOrigin.replace(/\/$/, "");
    const { subject, html, text } = buildInterviewReminder({
      userName: application.user.name,
      kind: interview.kind,
      companyName: application.company.name,
      position: application.position,
      scheduledAt: interview.scheduledAt,
      notes: interview.notes,
      applicationUrl: `${origin}/applications/${encodeURIComponent(application.id)}`,
      timeZone: effectiveTimeZone(application.user.timeZone, this.config.reminderTz),
    });

    const { id } = await this.emailSender.send({
      to: application.user.email,
      subject,
      html,
      text,
      idempotencyKey: `interview-reminder:${interview.id}:${job.scheduledAt}`,
    });
    await this.repository.markReminded(interview.id, interview.scheduledAt);
    this.logger.log(`Sent interview reminder ${id} for interview ${interview.id}`);
    return { sent: true };
  }

  private window(now: Date): { from: Date; to: Date } {
    return { from: now, to: new Date(now.getTime() + this.config.interviewReminderLeadHours * HOUR_MS) };
  }
}
