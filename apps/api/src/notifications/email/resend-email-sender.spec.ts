import { EmailSendError, type EmailMessage } from "./email-sender";
import { ResendEmailSender } from "./resend-email-sender";

describe("ResendEmailSender", () => {
  const message: EmailMessage = {
    to: "me@example.com",
    subject: "Subject",
    html: "<p>Hi</p>",
    text: "Hi",
    idempotencyKey: "key-1",
  };

  const jsonResponse = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  function senderWith(fetchFn: jest.Mock): ResendEmailSender {
    return new ResendEmailSender("re_test", "Job Tracker <from@example.com>", fetchFn as unknown as typeof fetch);
  }

  async function expectSendError(sender: ResendEmailSender): Promise<EmailSendError> {
    const error: unknown = await sender.send(message).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailSendError);
    return error as EmailSendError;
  }

  it("posts the message with auth and idempotency headers and returns the id", async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, { id: "email-1" }));

    await expect(senderWith(fetchFn).send(message)).resolves.toEqual({ id: "email-1" });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test", "Idempotency-Key": "key-1" });
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Job Tracker <from@example.com>",
      to: ["me@example.com"],
      subject: "Subject",
      html: "<p>Hi</p>",
      text: "Hi",
    });
  });

  it.each([400, 401, 403, 422])("treats a %i as non-retryable", async (status) => {
    const error = await expectSendError(senderWith(jest.fn().mockResolvedValue(jsonResponse(status, {}))));
    expect(error.retryable).toBe(false);
  });

  it.each([429, 500, 503])("treats a %i as retryable", async (status) => {
    const error = await expectSendError(senderWith(jest.fn().mockResolvedValue(jsonResponse(status, {}))));
    expect(error.retryable).toBe(true);
  });

  it("treats a network failure as retryable", async () => {
    const error = await expectSendError(senderWith(jest.fn().mockRejectedValue(new TypeError("fetch failed"))));
    expect(error.retryable).toBe(true);
  });

  it("rejects a success response without an id", async () => {
    const error = await expectSendError(senderWith(jest.fn().mockResolvedValue(jsonResponse(200, { nope: true }))));
    expect(error.retryable).toBe(true);
  });
});
