import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import { AppConfigService } from "../config/app-config.service";
import { EMAIL_SENDER, type EmailSender } from "./email/email-sender";
import {
  FollowUpRemindersRepository,
  type FollowUpReminderUser,
  type UnremindedFollowUp,
} from "./follow-up-reminders.repository";
import { FollowUpRemindersService } from "./follow-up-reminders.service";
import { REMINDERS_QUEUE } from "./notifications.constants";

// 06:00 UTC: 09:00 in Istanbul (the default zone), 01:00 in New York.
const now = new Date("2026-12-03T06:00:00.000Z");

function followUp(overrides: Partial<UnremindedFollowUp> = {}): UnremindedFollowUp {
  return {
    id: "fu-1",
    dueDate: new Date("2026-12-03T00:00:00.000Z"),
    note: "E-mail Jane again",
    contact: { name: "Jane Doe", deletedAt: null },
    application: { id: "app-1", position: "Backend Engineer", company: { name: "Acme" } },
    ...overrides,
  };
}

const user = (id: string, timeZone: string | null = null): FollowUpReminderUser => ({
  id,
  email: `${id}@example.com`,
  name: "Orhun",
  timeZone,
});

describe("FollowUpRemindersService", () => {
  let service: FollowUpRemindersService;
  let repository: jest.Mocked<Pick<FollowUpRemindersRepository, "findUsers" | "findUnreminded" | "markReminded">>;
  let emailSender: jest.Mocked<EmailSender>;
  let queue: { addBulk: jest.Mock };

  beforeEach(async () => {
    repository = { findUsers: jest.fn(), findUnreminded: jest.fn(), markReminded: jest.fn() };
    emailSender = { send: jest.fn().mockResolvedValue({ id: "email-1" }) };
    queue = { addBulk: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        FollowUpRemindersService,
        { provide: FollowUpRemindersRepository, useValue: repository },
        {
          provide: AppConfigService,
          useValue: { reminderTz: "Europe/Istanbul", reminderHour: 9, webOrigin: "http://localhost:3000" },
        },
        { provide: EMAIL_SENDER, useValue: emailSender },
        { provide: getQueueToken(REMINDERS_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(FollowUpRemindersService);
  });

  const queuedJobs = () => queue.addBulk.mock.calls[0]![0] as Array<{ data: unknown; opts: { jobId: string } }>;

  describe("enqueueDue", () => {
    it("queues one digest per user with unreminded follow-ups due by their local today", async () => {
      repository.findUsers.mockResolvedValue([user("user-1"), user("user-2")]);
      repository.findUnreminded.mockImplementation(async (userId) => (userId === "user-1" ? [followUp()] : []));

      await expect(service.enqueueDue(now)).resolves.toBe(1);

      expect(repository.findUnreminded).toHaveBeenCalledWith("user-1", new Date("2026-12-03T00:00:00.000Z"));
      expect(queuedJobs().map((j) => j.data)).toEqual([{ userId: "user-1", digestDate: "2026-12-03" }]);
      expect(queuedJobs()[0]!.opts.jobId).toBe("follow-up-digest-user-1-2026-12-03");
    });

    it("only looks at users whose local time is the reminder hour", async () => {
      repository.findUsers.mockResolvedValue([user("new-york", "America/New_York"), user("istanbul")]);
      repository.findUnreminded.mockResolvedValue([followUp()]);

      await service.enqueueDue(now);

      expect(repository.findUnreminded).toHaveBeenCalledTimes(1);
      expect(queuedJobs().map((j) => j.data)).toEqual([{ userId: "istanbul", digestDate: "2026-12-03" }]);
    });

    it("uses the user's local day, not the UTC day", async () => {
      // 14:00 UTC on Dec 2 is 09:00 on Dec 2 in New York.
      repository.findUsers.mockResolvedValue([user("new-york", "America/New_York")]);
      repository.findUnreminded.mockResolvedValue([followUp()]);

      await service.enqueueDue(new Date("2026-12-02T14:00:00.000Z"));

      expect(repository.findUnreminded).toHaveBeenCalledWith("new-york", new Date("2026-12-02T00:00:00.000Z"));
    });
  });

  describe("send", () => {
    const job = { userId: "user-1", digestDate: "2026-12-03" };

    it("does nothing when the user turned reminders off meanwhile", async () => {
      repository.findUsers.mockResolvedValue([]);

      await expect(service.send(job, now)).resolves.toEqual({ sent: false });

      expect(repository.findUsers).toHaveBeenCalledWith("user-1");
      expect(emailSender.send).not.toHaveBeenCalled();
    });

    it("does nothing when nothing is due anymore", async () => {
      repository.findUsers.mockResolvedValue([user("user-1")]);
      repository.findUnreminded.mockResolvedValue([]);

      await expect(service.send(job, now)).resolves.toEqual({ sent: false });

      expect(emailSender.send).not.toHaveBeenCalled();
      expect(repository.markReminded).not.toHaveBeenCalled();
    });

    it("sends one e-mail, then marks every follow-up in it reminded", async () => {
      repository.findUsers.mockResolvedValue([user("user-1")]);
      repository.findUnreminded.mockResolvedValue([
        followUp(),
        followUp({ id: "fu-2", contact: { name: "Gone", deletedAt: new Date() } }),
      ]);

      await expect(service.send(job, now)).resolves.toEqual({ sent: true });

      expect(emailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user-1@example.com",
          subject: "2 follow-ups are due",
          idempotencyKey: "follow-up-digest:user-1:2026-12-03",
        }),
      );
      const { text } = emailSender.send.mock.calls[0]![0];
      expect(text).toContain("with Jane Doe");
      expect(text).not.toContain("Gone");
      expect(repository.markReminded).toHaveBeenCalledWith(["fu-1", "fu-2"], now);
    });

    it("doesn't mark anything when sending fails, so the retry covers them", async () => {
      repository.findUsers.mockResolvedValue([user("user-1")]);
      repository.findUnreminded.mockResolvedValue([followUp()]);
      emailSender.send.mockRejectedValue(new Error("boom"));

      await expect(service.send(job, now)).rejects.toThrow("boom");
      expect(repository.markReminded).not.toHaveBeenCalled();
    });
  });
});
