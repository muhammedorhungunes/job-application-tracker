import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import type { EmailMessage, EmailSender } from "./email-sender";

/** Used when no RESEND_API_KEY is set (development/test): logs instead of sending. */
export class ConsoleEmailSender implements EmailSender {
  private readonly logger = new Logger(ConsoleEmailSender.name);

  async send(message: EmailMessage): Promise<{ id: string }> {
    this.logger.log(`Email to ${message.to} — "${message.subject}"\n${message.text}`);
    return { id: `console-${randomUUID()}` };
  }
}
