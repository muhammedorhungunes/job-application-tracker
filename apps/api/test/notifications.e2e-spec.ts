import { randomUUID } from "node:crypto";
import { getQueueToken } from "@nestjs/bullmq";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Queue } from "bullmq";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { ANTHROPIC_CLIENT } from "../src/ai/ai.client";
import { AppConfigService } from "../src/config/app-config.service";
import { EMAIL_SENDER, type EmailMessage } from "../src/notifications/email/email-sender";
import { InterviewRemindersService } from "../src/notifications/interview-reminders.service";
import { REMINDERS_QUEUE, SEND_DIGEST_JOB } from "../src/notifications/notifications.constants";
import { RemindersService } from "../src/notifications/reminders.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { pickCookie } from "./helpers";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Reminder digests against real Postgres and Redis (the BullMQ worker really
 * runs). Only the email sender is faked. Everything is scoped to a freshly
 * registered user, so other rows in the database don't affect the assertions.
 */
describe("Reminder digests (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reminders: RemindersService;
  let interviewReminders: InterviewRemindersService;
  let queue: Queue;
  let cookie: string;
  let email: string;
  let userId: string;

  const send = jest.fn<Promise<{ id: string }>, [EmailMessage]>();
  const sentToUser = (): EmailMessage[] => send.mock.calls.map(([m]) => m).filter((m) => m.to === email);

  async function createApplication(position: string, status: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/applications")
      .set("Cookie", [cookie])
      .send({ companyName: `Co ${position}`, position, status })
      .expect(201);
    return res.body.id as string;
  }

  /** Simulates time passing; an explicit value overrides Prisma's @updatedAt. */
  async function makeStale(applicationId: string, days: number): Promise<void> {
    await prisma.client.application.update({
      where: { id: applicationId },
      data: { updatedAt: new Date(Date.now() - days * DAY_MS) },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ANTHROPIC_CLIENT)
      .useValue({})
      .overrideProvider(EMAIL_SENDER)
      .useValue({ send })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    reminders = app.get(RemindersService);
    interviewReminders = app.get(InterviewRemindersService);
    queue = app.get<Queue>(getQueueToken(REMINDERS_QUEUE));

    email = `${randomUUID()}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: "Reminder User" })
      .expect(201);
    cookie = pickCookie(res.headers["set-cookie"], "access_token");
    userId = (await prisma.client.user.findFirstOrThrow({ where: { email } })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ id: `email-${randomUUID()}` });
  });

  it("emails one digest with only the stale, remindable applications, once", async () => {
    const applied = await createApplication("Stale applied", "APPLIED");
    const interviewing = await createApplication("Stale interviewing", "INTERVIEWING");
    const offer = await createApplication("Stale offer", "OFFER");
    await createApplication("Fresh applied", "APPLIED");
    const deleted = await createApplication("Deleted applied", "APPLIED");
    await Promise.all([applied, interviewing, offer, deleted].map((id) => makeStale(id, 8)));
    await request(app.getHttpServer()).delete(`/applications/${deleted}`).set("Cookie", [cookie]).expect(204);
    await makeStale(deleted, 8); // the soft delete bumped updatedAt

    // Through the real queue and worker.
    await queue.add(SEND_DIGEST_JOB, { userId, digestDate: "2026-11-05" });
    for (let i = 0; i < 50 && sentToUser().length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const sent = sentToUser();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe("2 applications have had no update for a while");
    expect(sent[0]!.text).toContain("Stale applied");
    expect(sent[0]!.text).toContain("Stale interviewing");
    expect(sent[0]!.text).not.toContain("Stale offer");
    expect(sent[0]!.text).not.toContain("Fresh applied");
    expect(sent[0]!.text).not.toContain("Deleted applied");

    // Already reminded and nothing changed since: no second email.
    await expect(reminders.sendDigest({ userId, digestDate: "2026-11-06" }, new Date())).resolves.toEqual({
      sent: false,
    });
    expect(sentToUser()).toHaveLength(1);
  });

  it("reminds again after the application is updated and goes quiet again", async () => {
    const id = await createApplication("Revived", "APPLIED");
    await makeStale(id, 8);
    await expect(reminders.sendDigest({ userId, digestDate: "2026-11-05" }, new Date())).resolves.toEqual({
      sent: true,
    });

    await request(app.getHttpServer())
      .patch(`/applications/${id}`)
      .set("Cookie", [cookie])
      .send({ notes: "Followed up" })
      .expect(200);
    // Updated, but not stale yet.
    send.mockClear();
    await expect(reminders.sendDigest({ userId, digestDate: "2026-11-06" }, new Date())).resolves.toEqual({
      sent: false,
    });

    // Fast-forward: the reminder went out 20 days ago, the update 8 days ago.
    await prisma.client.applicationReminder.updateMany({
      where: { applicationId: id },
      data: { sentAt: new Date(Date.now() - 20 * DAY_MS) },
    });
    await makeStale(id, 8);
    await expect(reminders.sendDigest({ userId, digestDate: "2026-11-13" }, new Date())).resolves.toEqual({
      sent: true,
    });
    expect(sentToUser().at(-1)!.text).toContain("Revived");
  });

  describe("interview reminders", () => {
    const sentFor = (position: string): EmailMessage[] => sentToUser().filter((m) => m.text.includes(position));

    async function scheduleInterview(applicationId: string, inHours: number, kind = "TECHNICAL"): Promise<string> {
      const res = await request(app.getHttpServer())
        .post(`/applications/${applicationId}/interviews`)
        .set("Cookie", [cookie])
        .send({ kind, scheduledAt: new Date(Date.now() + inHours * HOUR_MS).toISOString() })
        .expect(201);
      return res.body.id as string;
    }

    async function waitForEmail(position: string): Promise<void> {
      for (let i = 0; i < 50 && sentFor(position).length === 0; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    it("reminds once about an interview within the lead time, through the real queue", async () => {
      const soon = await createApplication("Interview soon", "INTERVIEWING");
      const later = await createApplication("Interview later", "INTERVIEWING");
      const past = await createApplication("Interview past", "INTERVIEWING");
      const cancelled = await createApplication("Interview cancelled", "INTERVIEWING");
      const rejected = await createApplication("Interview rejected", "INTERVIEWING");
      await scheduleInterview(soon, 5);
      await scheduleInterview(later, 48);
      await scheduleInterview(past, -2);
      const cancelledId = await scheduleInterview(cancelled, 5);
      await request(app.getHttpServer())
        .delete(`/applications/${cancelled}/interviews/${cancelledId}`)
        .set("Cookie", [cookie])
        .expect(204);
      await scheduleInterview(rejected, 5);
      await request(app.getHttpServer())
        .patch(`/applications/${rejected}`)
        .set("Cookie", [cookie])
        .send({ status: "REJECTED" })
        .expect(200);

      await interviewReminders.enqueueDue(new Date());
      await waitForEmail("Interview soon");
      // Give the worker a moment to (not) send the others too.
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(sentFor("Interview soon")).toHaveLength(1);
      expect(sentFor("Interview soon")[0]!.subject).toMatch(
        /^Reminder: Technical interview with Co Interview soon on .+ at \d{2}:\d{2} \(Europe\/Istanbul\)$/,
      );
      for (const position of ["Interview later", "Interview past", "Interview cancelled", "Interview rejected"]) {
        expect(sentFor(position)).toHaveLength(0);
      }

      // Already reminded for this time: a second scan queues nothing for it.
      await interviewReminders.enqueueDue(new Date());
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(sentFor("Interview soon")).toHaveLength(1);
    });

    it("reminds again after the interview is rescheduled", async () => {
      const applicationId = await createApplication("Interview moved", "INTERVIEWING");
      const interviewId = await scheduleInterview(applicationId, 5, "PHONE");
      const first = (await prisma.client.interview.findFirstOrThrow({ where: { id: interviewId } })).scheduledAt;
      await expect(
        interviewReminders.send({ interviewId, scheduledAt: first.toISOString() }, new Date()),
      ).resolves.toEqual({ sent: true });

      const moved = new Date(Date.now() + 8 * HOUR_MS).toISOString();
      await request(app.getHttpServer())
        .patch(`/applications/${applicationId}/interviews/${interviewId}`)
        .set("Cookie", [cookie])
        .send({ scheduledAt: moved })
        .expect(200);

      // The job queued for the old time is now a no-op…
      await expect(
        interviewReminders.send({ interviewId, scheduledAt: first.toISOString() }, new Date()),
      ).resolves.toEqual({ sent: false });
      // …and the new time is reminded about.
      await expect(interviewReminders.send({ interviewId, scheduledAt: moved }, new Date())).resolves.toEqual({
        sent: true,
      });
      expect(sentFor("Interview moved")).toHaveLength(2);
      expect(sentFor("Interview moved").map((m) => m.idempotencyKey)).toEqual([
        `interview-reminder:${interviewId}:${first.toISOString()}`,
        `interview-reminder:${interviewId}:${moved}`,
      ]);
    });
  });

  describe("per-user settings", () => {
    // A separate user so turning reminders off doesn't affect the tests above.
    let userCookie: string;
    let userEmail: string;
    let settingsUserId: string;
    const sentTo = (): EmailMessage[] => send.mock.calls.map(([m]) => m).filter((m) => m.to === userEmail);

    async function createStale(position: string): Promise<string> {
      const res = await request(app.getHttpServer())
        .post("/applications")
        .set("Cookie", [userCookie])
        .send({ companyName: `Co ${position}`, position, status: "INTERVIEWING" })
        .expect(201);
      await prisma.client.application.update({
        where: { id: res.body.id },
        data: { updatedAt: new Date(Date.now() - 10 * DAY_MS) },
      });
      return res.body.id as string;
    }

    const patchSettings = (body: object) =>
      request(app.getHttpServer()).patch("/settings").set("Cookie", [userCookie]).send(body).expect(200);

    /** The next moment at or after now whose hour in UTC is `hour`, on the hour. */
    function nextUtcHour(hour: number): Date {
      const at = new Date();
      at.setUTCMinutes(0, 0, 0);
      while (at.getUTCHours() !== hour || at.getTime() < Date.now() - HOUR_MS) {
        at.setTime(at.getTime() + HOUR_MS);
      }
      return at;
    }

    beforeAll(async () => {
      userEmail = `${randomUUID()}@test.local`;
      const res = await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: userEmail, password: "password123", name: "Settings Reminder User" })
        .expect(201);
      userCookie = pickCookie(res.headers["set-cookie"], "access_token");
      settingsUserId = (await prisma.client.user.findFirstOrThrow({ where: { email: userEmail } })).id;
      await createStale("Settings stale");
      await patchSettings({ timeZone: "UTC" });
    });

    it("queues the digest only at the user's local reminder hour", async () => {
      const config = app.get(AppConfigService);
      const atHour = nextUtcHour(config.reminderHour);

      await reminders.enqueueDigests(new Date(atHour.getTime() - HOUR_MS));
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(sentTo()).toHaveLength(0);

      await reminders.enqueueDigests(atHour);
      for (let i = 0; i < 50 && sentTo().length === 0; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(sentTo()).toHaveLength(1);
      expect(sentTo()[0]!.idempotencyKey).toBe(
        `reminder-digest:${settingsUserId}:${atHour.toISOString().slice(0, 10)}`,
      );
    });

    it("skips the digest when the user turned it off or raised the threshold", async () => {
      // Update the application so it's due again, then let it go quiet.
      const applicationId = await createStale("Settings second");
      await prisma.client.applicationReminder.deleteMany({ where: { application: { userId: settingsUserId } } });
      await prisma.client.application.update({
        where: { id: applicationId },
        data: { updatedAt: new Date(Date.now() - 10 * DAY_MS) },
      });

      await patchSettings({ staleDays: 30 });
      await expect(reminders.sendDigest({ userId: settingsUserId, digestDate: "2026-11-20" }, new Date())).resolves.toEqual({
        sent: false,
      });

      await patchSettings({ staleDays: null, staleDigestEnabled: false });
      await expect(reminders.sendDigest({ userId: settingsUserId, digestDate: "2026-11-21" }, new Date())).resolves.toEqual({
        sent: false,
      });
      expect(sentTo()).toHaveLength(0);

      await patchSettings({ staleDigestEnabled: true });
      await expect(reminders.sendDigest({ userId: settingsUserId, digestDate: "2026-11-22" }, new Date())).resolves.toEqual({
        sent: true,
      });
    });

    it("shows interview times in the user's zone and stops when reminders are off", async () => {
      const res = await request(app.getHttpServer())
        .post("/applications")
        .set("Cookie", [userCookie])
        .send({ companyName: "Co Zoned", position: "Zoned interview", status: "INTERVIEWING" })
        .expect(201);
      const interview = await request(app.getHttpServer())
        .post(`/applications/${res.body.id}/interviews`)
        .set("Cookie", [userCookie])
        .send({ kind: "PHONE", scheduledAt: new Date(Date.now() + 5 * HOUR_MS).toISOString() })
        .expect(201);
      const job = { interviewId: interview.body.id as string, scheduledAt: interview.body.scheduledAt as string };

      await patchSettings({ interviewRemindersEnabled: false });
      await expect(interviewReminders.send(job, new Date())).resolves.toEqual({ sent: false });

      await patchSettings({ interviewRemindersEnabled: true, timeZone: "America/New_York" });
      await expect(interviewReminders.send(job, new Date())).resolves.toEqual({ sent: true });
      expect(sentTo().at(-1)!.subject).toMatch(/\(America\/New_York\)$/);
    });
  });
});
