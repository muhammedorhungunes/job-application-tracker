import { z } from "zod";
import { EmailSendError, type EmailMessage, type EmailSender } from "./email-sender";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

const ResendSendResponseSchema = z.object({ id: z.string().min(1) });

/** Talks to Resend's REST API with plain fetch, so the app doesn't need the SDK. */
export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<{ id: string }> {
    let response: Response;
    try {
      response = await this.fetchFn(RESEND_EMAILS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
    } catch (error) {
      throw new EmailSendError(`Resend request failed: ${error instanceof Error ? error.message : String(error)}`, true);
    }

    if (!response.ok) {
      // Like the AI processor: a 4xx fails identically on every attempt,
      // except rate limiting (429) and timeouts/conflicts (408/409).
      const retryable = response.status >= 500 || [408, 409, 429].includes(response.status);
      const body = await response.text().catch(() => "");
      throw new EmailSendError(`Resend responded ${response.status}: ${body.slice(0, 500)}`, retryable);
    }

    const parsed = ResendSendResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      // The email was most likely accepted; a retry is covered by the idempotency key.
      throw new EmailSendError("Resend returned an unexpected response body", true);
    }
    return parsed.data;
  }
}
