import { Logger, type Provider } from "@nestjs/common";
import { AppConfigService } from "../../config/app-config.service";
import { ConsoleEmailSender } from "./console-email-sender";
import { EMAIL_SENDER, type EmailSender } from "./email-sender";
import { ResendEmailSender } from "./resend-email-sender";

export const emailSenderProvider: Provider = {
  provide: EMAIL_SENDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): EmailSender => {
    const apiKey = config.resendApiKey;
    if (apiKey) {
      return new ResendEmailSender(apiKey, config.emailFrom);
    }
    // The env schema already refuses to boot production without a key.
    new Logger("EmailSender").warn("RESEND_API_KEY is not set; emails will be logged, not sent");
    return new ConsoleEmailSender();
  },
};
