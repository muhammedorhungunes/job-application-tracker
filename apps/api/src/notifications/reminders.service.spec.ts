import { getQueueToken } from "@nestjs/bullmq";
import { Test } from "@nestjs/testing";
import { AppConfigService } from "../config/app-config.service";
import { EMAIL_SENDER, type EmailSender } from "./email/email-sender";
import { REMINDERS_QUEUE } from "./notifications.constants";
import { RemindersRepository, type DigestUser, type ReminderCandidate } from "./reminders.repository";
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
  let repository: jest.Mocked<Pick<RemindersRepository, "findCandidates" | "recordReminders" | "findDigestUsers">>;
  let emailSender: jest.Mocked<EmailSender>;
  let queue: { addBulk: jest.Mock };

  // `now` is 06:00 UTC: 09:00 in Istanbul (the default zone), 01:00 in New York.
  const istanbulUser = (id: string, staleDays: number | null = null): DigestUser => ({ id, timeZone: null, staleDays });

  beforeEach(async () => {
    repository = { findCandidates: jest.fn(), recordReminders: jest.fn(), findDigestUsers: jest.fn() };
    emailSender = { send: jest.fn().mockResolvedValue({ id: "email-1" }) };
    queue = { addBulk: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: RemindersRepository, useValue: repository },
        {
          provide: AppConfigService,
          useValue: {
            reminderStaleDays: 7,
            reminderTz: "Europe/Istanbul",
            reminderHour: 9,
            webOrigin: "http://localhost:3000",
          },
        },
        { provide: EMAIL_SENDER, useValue: emailSender },
        { provide: getQueueToken(REMINDERS_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(RemindersService);
  });

  const queuedJobs = () => queue.addBulk.mock.calls[0]![0] as Array<{ data: unknown; opts: { jobId: string } }>;

  describe("enqueueDigests", () => {
    it("asks for remindable statuses older than the default stale threshold", async () => {
      repository.findDigestUsers.mockResolvedValue([istanbulUser("user-1")]);
      repository.findCandidates.mockResolvedValue([]);

      await service.enqueueDigests(now);

      expect(repository.findDigestUsers).toHaveBeenCalledWith();
      expect(repository.findCandidates).toHaveBeenCalledWith({
        statuses: ["APPLIED", "INTERVIEWING"],
        updatedBefore: daysAgo(7),
        userId: "user-1",
      });
    });

    it("uses each user's own stale threshold", async () => {
      repository.findDigestUsers.mockResolvedValue([istanbulUser("user-1", 14)]);
      repository.findCandidates.mockResolvedValue([]);

      await service.enqueueDigests(now);

      expect(repository.findCandidates).toHaveBeenCalledWith(expect.objectContaining({ updatedBefore: daysAgo(14) }));
    });

    it("queues one digest per user with due applications", async () => {
      repository.findDigestUsers.mockResolvedValue([istanbulUser("user-1"), istanbulUser("user-2"), istanbulUser("user-3")]);
      repository.findCandidates.mockImplementation(async ({ userId }) =>
        ({
          "user-1": [candidate({ id: "a" }), candidate({ id: "b" })],
          "user-2": [candidate({ id: "c", userId: "user-2" })],
          "user-3": [candidate({ id: "d", userId: "user-3", reminders: [{ sentAt: daysAgo(1) }] })],
        })[userId] ?? [],
      );

      await expect(service.enqueueDigests(now)).resolves.toBe(2);

      expect(queuedJobs().map((j) => j.data)).toEqual([
        { userId: "user-1", digestDate: "2026-11-05" },
        { userId: "user-2", digestDate: "2026-11-05" },
      ]);
      expect(queuedJobs()[0]!.opts.jobId).toBe("digest-user-1-2026-11-05");
    });

    it("only queues users whose local time is the reminder hour, dated by their local day", async () => {
      repository.findDigestUsers.mockResolvedValue([
        { id: "new-york", timeZone: "America/New_York", staleDays: null }, // 01:00
        { id: "istanbul", timeZone: null, staleDays: null }, // 09:00
        { id: "kiritimati", timeZone: "Pacific/Kiritimati", staleDays: null }, // 20:00
      ]);
      repository.findCandidates.mockResolvedValue([candidate()]);

      await service.enqueueDigests(now);

      expect(repository.findCandidates).toHaveBeenCalledTimes(1);
      expect(queuedJobs().map((j) => j.data)).toEqual([{ userId: "istanbul", digestDate: "2026-11-05" }]);

      // 19:00 UTC on Nov 4 is 09:00 on Nov 5 in Kiritimati (UTC+14).
      queue.addBulk.mockClear();
      await service.enqueueDigests(new Date("2026-11-04T19:00:00.000Z"));
      expect(queuedJobs().map((j) => j.data)).toEqual([{ userId: "kiritimati", digestDate: "2026-11-05" }]);
    });

    it("falls back to the default zone when a stored zone is no longer valid", async () => {
      repository.findDigestUsers.mockResolvedValue([{ id: "user-1", timeZone: "Gone/Zone", staleDays: null }]);
      repository.findCandidates.mockResolvedValue([candidate()]);

      await expect(service.enqueueDigests(now)).resolves.toBe(1);
    });
  });

  describe("sendDigest", () => {
    const job = { userId: "user-1", digestDate: "2026-11-05" };

    beforeEach(() => {
      repository.findDigestUsers.mockResolvedValue([istanbulUser("user-1")]);
    });

    it("does nothing when the user turned the digest off meanwhile", async () => {
      repository.findDigestUsers.mockResolvedValue([]);

      await expect(service.sendDigest(job, now)).resolves.toEqual({ sent: false });

      expect(repository.findDigestUsers).toHaveBeenCalledWith("user-1");
      expect(repository.findCandidates).not.toHaveBeenCalled();
      expect(emailSender.send).not.toHaveBeenCalled();
    });

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

    it("re-checks with the user's current stale threshold", async () => {
      repository.findDigestUsers.mockResolvedValue([istanbulUser("user-1", 30)]);
      repository.findCandidates.mockResolvedValue([]);

      await service.sendDigest(job, now);

      expect(repository.findCandidates).toHaveBeenCalledWith(expect.objectContaining({ updatedBefore: daysAgo(30) }));
    });

    it("doesn't record reminders when sending fails", async () => {
      repository.findCandidates.mockResolvedValue([candidate()]);
      emailSender.send.mockRejectedValue(new Error("boom"));

      await expect(service.sendDigest(job, now)).rejects.toThrow("boom");

      expect(repository.recordReminders).not.toHaveBeenCalled();
    });
  });
});
