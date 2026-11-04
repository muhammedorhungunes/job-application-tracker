export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Lets the provider drop a duplicate when a queue job retries after a successful send. */
  idempotencyKey: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string }>;
}

/** Injection token, so tests can swap in a fake sender without touching the network. */
export const EMAIL_SENDER = Symbol("EMAIL_SENDER");

/**
 * Thrown when a send fails. A plain Error rather than an HTTP exception: this
 * only runs inside queue jobs, where `retryable` decides whether BullMQ gets
 * another attempt.
 */
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}
