import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import { AppConfigService } from "../config/app-config.service";
import { EMAIL_SENDER, type EmailSender } from "./email/email-sender";
import { REMINDERS_QUEUE } from "./notifications.constants";
import { RemindersRepository, type ReminderCandidate } from "./reminders.repository";
import { RemindersService, isDue } from "./reminders.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-05T06:00:00.000Z");
const daysAgo = (days: number): Date => new Date(now.getTime() - days * DAY_MS);

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    id: "app-1",
    userId: "user-1",
    position: "Backend Engineer",
    status: "APPLIED",
    updatedAt: daysAgo(10),
    user: { email: "me@example.com", name: "Orhun" },
    company: { name: "Acme" },
    reminders: [],
    ...overrides,
  };
}

describe("isDue", () => {
  it("is due when the application was never reminded about", () => {
    expect(isDue(candidate())).toBe(true);
  });

  it("is not due when a reminder was sent after the last update", () => {
    expect(isDue(candidate({ reminders: [{ sentAt: daysAgo(2) }] }))).toBe(false);
  });

  it("is due again once the application is updated after the last reminder", () => {
    expect(isDue(candidate({ updatedAt: daysAgo(8), reminders: [{ sentAt: daysAgo(20) }] }))).toBe(true);
  });
});

describe("RemindersService", () => {
  let service: RemindersService;
  let repository: jest.Mocked<Pick<RemindersRepository, "findCandidates" | "recordReminders">>;
  let emailSender: jest.Mocked<EmailSender>;
  let queue: { addBulk: jest.Mock };

  beforeEach(async () => {
    repository = { findCandidates: jest.fn(), recordReminders: jest.fn() };
    emailSender = { send: jest.fn().mockResolvedValue({ id: "email-1" }) };
    queue = { addBulk: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: RemindersRepository, useValue: repository },
        { provide: AppConfigService, useValue: { reminderStaleDays: 7, webOrigin: "http://localhost:3000" } },
        { provide: EMAIL_SENDER, useValue: emailSender },
        { provide: getQueueToken(REMINDERS_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(RemindersService);
  });

  describe("enqueueDigests", () => {
    it("asks for remindable statuses older than the stale threshold", async () => {
      repository.findCandidates.mockResolvedValue([]);

      await service.enqueueDigests(now);

      expect(repository.findCandidates).toHaveBeenCalledWith({
        statuses: ["APPLIED", "INTERVIEWING"],
        updatedBefore: daysAgo(7),
        userId: undefined,
      });
    });

    it("queues one digest per user with due applications", async () => {
      repository.findCandidates.mockResolvedValue([
        candidate({ id: "a", userId: "user-1" }),
        candidate({ id: "b", userId: "user-1" }),
        candidate({ id: "c", userId: "user-2" }),
        candidate({ id: "d", userId: "user-3", reminders: [{ sentAt: daysAgo(1) }] }),
      ]);

      await expect(service.enqueueDigests(now)).resolves.toBe(2);

      const jobs = queue.addBulk.mock.calls[0]![0] as Array<{ data: unknown; opts: { jobId: string } }>;
      expect(jobs.map((j) => j.data)).toEqual([
        { userId: "user-1", digestDate: "2026-11-05" },
        { userId: "user-2", digestDate: "2026-11-05" },
      ]);
      expect(jobs[0]!.opts.jobId).toBe("digest-user-1-2026-11-05");
    });
  });

  describe("sendDigest", () => {
    const job = { userId: "user-1", digestDate: "2026-11-05" };

    it("does nothing when nothing is due anymore", async () => {
      repository.findCandidates.mockResolvedValue([candidate({ reminders: [{ sentAt: daysAgo(1) }] })]);

      await expect(service.sendDigest(job, now)).resolves.toEqual({ sent: false });

      expect(emailSender.send).not.toHaveBeenCalled();
      expect(repository.recordReminders).not.toHaveBeenCalled();
    });

    it("sends one email covering every due application, then records them", async () => {
      repository.findCandidates.mockResolvedValue([
        candidate({ id: "a" }),
        candidate({ id: "b", company: { name: "Globex" } }),
      ]);

      await expect(service.sendDigest(job, now)).resolves.toEqual({ sent: true });

      expect(repository.findCandidates).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" }));
      expect(emailSender.send).toHaveBeenCalledTimes(1);
      expect(emailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "me@example.com",
          subject: "2 applications have had no update for a while",
          idempotencyKey: "reminder-digest:user-1:2026-11-05",
        }),
      );
      expect(repository.recordReminders).toHaveBeenCalledWith(["a", "b"], now);
    });

    it("doesn't record reminders when sending fails", async () => {
      repository.findCandidates.mockResolvedValue([candidate()]);
      emailSender.send.mockRejectedValue(new Error("boom"));

      await expect(service.sendDigest(job, now)).rejects.toThrow("boom");

      expect(repository.recordReminders).not.toHaveBeenCalled();
    });
  });
});
