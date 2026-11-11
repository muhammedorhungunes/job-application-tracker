import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import { AppConfigService } from "../config/app-config.service";
import {
  DAILY_SCAN_SCHEDULER_ID,
  DIGEST_SCAN_PATTERN,
  INTERVIEW_SCAN_JOB,
  INTERVIEW_SCAN_SCHEDULER_ID,
  REMINDERS_QUEUE,
  SCAN_JOB,
} from "./notifications.constants";

/** Registers the reminder scans in Redis. Upsert, so restarts and config changes don't stack schedules. */
@Injectable()
export class RemindersScheduler implements OnModuleInit {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(
    @InjectQueue(REMINDERS_QUEUE) private readonly queue: Queue,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Hourly in UTC: each user's digest goes out at REMINDER_HOUR in their own
    // zone, so the scan has to run every hour rather than once a day.
    await this.queue.upsertJobScheduler(
      DAILY_SCAN_SCHEDULER_ID,
      { pattern: DIGEST_SCAN_PATTERN },
      { name: SCAN_JOB, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    this.logger.log(`Reminder digest scan scheduled: "${DIGEST_SCAN_PATTERN}" (UTC), sends at ${this.config.reminderHour}:00 local`);

    const interviewPattern = this.config.interviewReminderCron;
    await this.queue.upsertJobScheduler(
      INTERVIEW_SCAN_SCHEDULER_ID,
      { pattern: interviewPattern },
      { name: INTERVIEW_SCAN_JOB, opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
    this.logger.log(`Interview reminder scan scheduled: "${interviewPattern}" (UTC)`);
  }
}
