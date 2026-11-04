import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { emailSenderProvider } from "./email/email-sender.provider";
import { REMINDERS_QUEUE } from "./notifications.constants";
import { RemindersProcessor } from "./reminders.processor";
import { RemindersRepository } from "./reminders.repository";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";

@Module({
  imports: [BullModule.registerQueue({ name: REMINDERS_QUEUE })],
  providers: [emailSenderProvider, RemindersRepository, RemindersService, RemindersProcessor, RemindersScheduler],
})
export class NotificationsModule {}
