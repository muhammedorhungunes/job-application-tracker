import { Test } from "@nestjs/testing";
import { UnrecoverableError, type Job } from "bullmq";
import { EmailSendError } from "./email/email-sender";
import { InterviewRemindersService } from "./interview-reminders.service";
import { RemindersProcessor } from "./reminders.processor";
import { RemindersService } from "./reminders.service";

describe("RemindersProcessor", () => {
  let processor: RemindersProcessor;
  let service: { enqueueDigests: jest.Mock; sendDigest: jest.Mock };
  let interviewService: { enqueueDue: jest.Mock; send: jest.Mock };

  const fakeJob = (name: string, data: unknown): Job<unknown> =>
    ({ name, data, attemptsMade: 0, opts: { attempts: 3 } }) as Job<unknown>;
  const digestData = { userId: "user-1", digestDate: "2026-11-05" };

  beforeEach(async () => {
    service = { enqueueDigests: jest.fn(), sendDigest: jest.fn() };
    interviewService = { enqueueDue: jest.fn(), send: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        RemindersProcessor,
        { provide: RemindersService, useValue: service },
        { provide: InterviewRemindersService, useValue: interviewService },
      ],
    }).compile();
    processor = module.get(RemindersProcessor);
  });

  it("queues digests on a scan job", async () => {
    await processor.process(fakeJob("scan", undefined));
    expect(service.enqueueDigests).toHaveBeenCalledWith(expect.any(Date));
  });

  it("sends a digest with validated job data", async () => {
    await processor.process(fakeJob("send-digest", digestData));
    expect(service.sendDigest).toHaveBeenCalledWith(digestData, expect.any(Date));
  });

  it("fails without retry on invalid job data", async () => {
    await expect(processor.process(fakeJob("send-digest", { userId: "" }))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(service.sendDigest).not.toHaveBeenCalled();
  });

  it("stops retrying on a non-retryable email error", async () => {
    service.sendDigest.mockRejectedValue(new EmailSendError("Resend responded 403", false));
    await expect(processor.process(fakeJob("send-digest", digestData))).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it("rethrows retryable errors as-is so BullMQ retries", async () => {
    const error = new EmailSendError("Resend responded 503", true);
    service.sendDigest.mockRejectedValue(error);
    await expect(processor.process(fakeJob("send-digest", digestData))).rejects.toBe(error);
  });

  describe("interview reminders", () => {
    const reminderData = { interviewId: "int-1", scheduledAt: "2026-11-12T11:00:00.000Z" };

    it("queues reminders on an interview scan job", async () => {
      await processor.process(fakeJob("interview-scan", undefined));
      expect(interviewService.enqueueDue).toHaveBeenCalledWith(expect.any(Date));
      expect(service.enqueueDigests).not.toHaveBeenCalled();
    });

    it("sends a reminder with validated job data", async () => {
      await processor.process(fakeJob("send-interview-reminder", reminderData));
      expect(interviewService.send).toHaveBeenCalledWith(reminderData, expect.any(Date));
    });

    it("fails without retry on invalid job data", async () => {
      await expect(
        processor.process(fakeJob("send-interview-reminder", { interviewId: "int-1", scheduledAt: "soon" })),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(interviewService.send).not.toHaveBeenCalled();
    });

    it("stops retrying on a non-retryable email error", async () => {
      interviewService.send.mockRejectedValue(new EmailSendError("Resend responded 422", false));
      await expect(processor.process(fakeJob("send-interview-reminder", reminderData))).rejects.toBeInstanceOf(
        UnrecoverableError,
      );
    });
  });
});
