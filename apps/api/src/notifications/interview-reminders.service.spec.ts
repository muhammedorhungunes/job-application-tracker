import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import { AppConfigService } from "../config/app-config.service";
import { EMAIL_SENDER, type EmailSender } from "./email/email-sender";
import { REMINDERS_QUEUE } from "./notifications.constants";
import { InterviewRemindersRepository, type DueInterview } from "./interview-reminders.repository";
import { InterviewRemindersService } from "./interview-reminders.service";

const now = new Date("2026-11-10T09:00:00.000Z");
const scheduledAt = new Date("2026-11-11T11:00:00.000Z");

function due(overrides: Partial<DueInterview> = {}): DueInterview {
  return {
    id: "int-1",
    kind: "TECHNICAL",
    scheduledAt,
    notes: "Bring laptop",
    application: {
      id: "app-1",
      position: "Backend Engineer",
      company: { name: "Acme" },
      user: { email: "me@example.com", name: "Orhun", timeZone: null },
    },
    ...overrides,
  };
}

describe("InterviewRemindersService", () => {
  let service: InterviewRemindersService;
  let repository: jest.Mocked<Pick<InterviewRemindersRepository, "findDue" | "markReminded">>;
  let emailSender: jest.Mocked<EmailSender>;
  let queue: { addBulk: jest.Mock };

  beforeEach(async () => {
    repository = { findDue: jest.fn(), markReminded: jest.fn() };
    emailSender = { send: jest.fn().mockResolvedValue({ id: "email-1" }) };
    queue = { addBulk: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        InterviewRemindersService,
        { provide: InterviewRemindersRepository, useValue: repository },
        {
          provide: AppConfigService,
          useValue: {
            interviewReminderLeadHours: 24,
            reminderTz: "Europe/Istanbul",
            webOrigin: "http://localhost:3000/",
          },
        },
        { provide: EMAIL_SENDER, useValue: emailSender },
        { provide: getQueueToken(REMINDERS_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(InterviewRemindersService);
  });

  describe("enqueueDue", () => {
    it("looks ahead by the lead time and queues one job per interview, keyed by its time", async () => {
      repository.findDue.mockResolvedValue([due()]);

      const count = await service.enqueueDue(now);

      expect(count).toBe(1);
      expect(repository.findDue).toHaveBeenCalledWith({ from: now, to: new Date("2026-11-11T09:00:00.000Z") });
      expect(queue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "send-interview-reminder",
          data: { interviewId: "int-1", scheduledAt: "2026-11-11T11:00:00.000Z" },
          opts: expect.objectContaining({ jobId: `interview-reminder-int-1-${scheduledAt.getTime()}`, attempts: 3 }),
        }),
      ]);
    });
  });

  describe("send", () => {
    const job = { interviewId: "int-1", scheduledAt: "2026-11-11T11:00:00.000Z" };

    it("re-checks the interview, sends the e-mail, then records the reminder", async () => {
      repository.findDue.mockResolvedValue([due()]);

      const result = await service.send(job, now);

      expect(result).toEqual({ sent: true });
      expect(repository.findDue).toHaveBeenCalledWith(expect.objectContaining({ interviewId: "int-1" }));
      expect(emailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "me@example.com",
          subject: "Reminder: Technical interview with Acme on Wed, Nov 11 at 14:00 (Europe/Istanbul)",
          idempotencyKey: "interview-reminder:int-1:2026-11-11T11:00:00.000Z",
          text: expect.stringContaining("http://localhost:3000/applications/app-1"),
        }),
      );
      expect(repository.markReminded).toHaveBeenCalledWith("int-1", scheduledAt);
    });

    it("shows the time in the user's own zone when they set one", async () => {
      const interview = due();
      interview.application.user.timeZone = "America/New_York";
      repository.findDue.mockResolvedValue([interview]);

      await service.send(job, now);

      expect(emailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Reminder: Technical interview with Acme on Wed, Nov 11 at 06:00 (America/New_York)",
        }),
      );
    });

    it("does nothing when the interview is no longer due (cancelled, closed, already reminded, reminders off)", async () => {
      repository.findDue.mockResolvedValue([]);

      expect(await service.send(job, now)).toEqual({ sent: false });
      expect(emailSender.send).not.toHaveBeenCalled();
      expect(repository.markReminded).not.toHaveBeenCalled();
    });

    it("leaves a rescheduled interview to the job for its new time", async () => {
      repository.findDue.mockResolvedValue([due({ scheduledAt: new Date("2026-11-11T08:00:00.000Z") })]);

      expect(await service.send(job, now)).toEqual({ sent: false });
      expect(emailSender.send).not.toHaveBeenCalled();
    });

    it("doesn't record the reminder when sending fails, so the retry sends again", async () => {
      repository.findDue.mockResolvedValue([due()]);
      emailSender.send.mockRejectedValue(new Error("network down"));

      await expect(service.send(job, now)).rejects.toThrow("network down");
      expect(repository.markReminded).not.toHaveBeenCalled();
    });
  });
});
