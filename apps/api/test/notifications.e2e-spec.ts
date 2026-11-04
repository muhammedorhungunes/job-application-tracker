import { randomUUID } from "node:crypto";
import { getQueueToken } from "@nestjs/bullmq";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Queue } from "bullmq";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { ANTHROPIC_CLIENT } from "../src/ai/ai.client";
import { EMAIL_SENDER, type EmailMessage } from "../src/notifications/email/email-sender";
import { REMINDERS_QUEUE, SEND_DIGEST_JOB } from "../src/notifications/notifications.constants";
import { RemindersService } from "../src/notifications/reminders.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { pickCookie } from "./helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reminder digests against real Postgres and Redis (the BullMQ worker really
 * runs). Only the email sender is faked. Everything is scoped to a freshly
 * registered user, so other rows in the database don't affect the assertions.
 */
describe("Reminder digests (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reminders: RemindersService;
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
});
