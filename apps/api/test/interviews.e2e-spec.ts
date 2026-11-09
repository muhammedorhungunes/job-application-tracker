import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { ActivitySchema, InterviewSchema, UpcomingInterviewSchema } from "@job-tracker/types";
import { AppModule } from "../src/app.module";
import { pickCookie } from "./helpers";

/** Same prerequisites as applications.e2e-spec.ts (local Postgres + migrations). */
describe("Interviews (e2e)", () => {
  let app: INestApplication;
  let ownerCookie: string;
  let otherUserCookie: string;

  async function registerAndGetAccessCookie(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: `${randomUUID()}@test.local`, password: "password123", name: "E2E User" })
      .expect(201);
    return pickCookie(res.headers["set-cookie"], "access_token");
  }

  async function createApplication(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/applications")
      .set("Cookie", [ownerCookie])
      .send({ position: "Engineer", companyName: `E2E Co ${randomUUID()}` })
      .expect(201);
    return res.body.id as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    ownerCookie = await registerAndGetAccessCookie();
    otherUserCookie = await registerAndGetAccessCookie();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects requests without an access token", async () => {
    await request(app.getHttpServer()).get("/applications/some-id/interviews").expect(401);
  });

  it("schedules, edits, reschedules and cancels, logging each real change", async () => {
    const server = app.getHttpServer();
    const applicationId = await createApplication();
    const base = `/applications/${applicationId}/interviews`;

    const createRes = await request(server)
      .post(base)
      .set("Cookie", [ownerCookie])
      .send({ kind: "PHONE", scheduledAt: "2026-11-12T11:00:00.000Z", notes: "Recruiter screen" })
      .expect(201);
    const interview = InterviewSchema.parse(createRes.body);
    expect(interview).toEqual(
      expect.objectContaining({ kind: "PHONE", scheduledAt: "2026-11-12T11:00:00.000Z", notes: "Recruiter screen" }),
    );

    // Notes-only edit: no timeline entry.
    await request(server)
      .patch(`${base}/${interview.id}`)
      .set("Cookie", [ownerCookie])
      .send({ notes: null })
      .expect(200);
    const rescheduled = await request(server)
      .patch(`${base}/${interview.id}`)
      .set("Cookie", [ownerCookie])
      .send({ scheduledAt: "2026-11-13T09:30:00.000Z" })
      .expect(200);
    expect(rescheduled.body).toEqual(expect.objectContaining({ scheduledAt: "2026-11-13T09:30:00.000Z", notes: null }));

    const listRes = await request(server).get(base).set("Cookie", [ownerCookie]).expect(200);
    expect(InterviewSchema.array().parse(listRes.body)).toHaveLength(1);

    await request(server).delete(`${base}/${interview.id}`).set("Cookie", [ownerCookie]).expect(204);
    const afterCancel = await request(server).get(base).set("Cookie", [ownerCookie]).expect(200);
    expect(afterCancel.body).toEqual([]);
    await request(server).delete(`${base}/${interview.id}`).set("Cookie", [ownerCookie]).expect(404);

    const activitiesRes = await request(server)
      .get(`/applications/${applicationId}/activities`)
      .set("Cookie", [ownerCookie])
      .expect(200);
    const activities = ActivitySchema.array().parse(activitiesRes.body);
    expect(activities.map(({ type, description }) => ({ type, description }))).toEqual([
      { type: "INTERVIEW_CANCELLED", description: "Phone interview cancelled" },
      { type: "INTERVIEW_SCHEDULED", description: "Phone interview rescheduled" },
      { type: "INTERVIEW_SCHEDULED", description: "Phone interview scheduled" },
      { type: "APPLICATION_CREATED", description: "Added as Applied" },
    ]);
  });

  it("lists interviews soonest first", async () => {
    const server = app.getHttpServer();
    const base = `/applications/${await createApplication()}/interviews`;

    for (const scheduledAt of ["2026-11-20T10:00:00.000Z", "2026-11-15T10:00:00.000Z"]) {
      await request(server).post(base).set("Cookie", [ownerCookie]).send({ kind: "TECHNICAL", scheduledAt }).expect(201);
    }

    const res = await request(server).get(base).set("Cookie", [ownerCookie]).expect(200);
    expect(res.body.map((i: { scheduledAt: string }) => i.scheduledAt)).toEqual([
      "2026-11-15T10:00:00.000Z",
      "2026-11-20T10:00:00.000Z",
    ]);
  });

  it("validates the body", async () => {
    const base = `/applications/${await createApplication()}/interviews`;

    await request(app.getHttpServer())
      .post(base)
      .set("Cookie", [ownerCookie])
      .send({ kind: "LUNCH", scheduledAt: "tomorrow" })
      .expect(400);
  });

  it("hides one user's interviews from another user", async () => {
    const server = app.getHttpServer();
    const base = `/applications/${await createApplication()}/interviews`;
    const createRes = await request(server)
      .post(base)
      .set("Cookie", [ownerCookie])
      .send({ kind: "ONSITE", scheduledAt: "2026-11-20T10:00:00.000Z" })
      .expect(201);

    await request(server).get(base).set("Cookie", [otherUserCookie]).expect(404);
    await request(server)
      .patch(`${base}/${createRes.body.id}`)
      .set("Cookie", [otherUserCookie])
      .send({ notes: "x" })
      .expect(404);
    await request(server).delete(`${base}/${createRes.body.id}`).set("Cookie", [otherUserCookie]).expect(404);
  });

  describe("GET /interviews/upcoming", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

    it("lists the user's interviews in the window across open applications, soonest first", async () => {
      const server = app.getHttpServer();
      // Fresh user so other tests' interviews don't show up.
      const cookie = await registerAndGetAccessCookie();
      const newApplication = async (companyName: string) => {
        const res = await request(server)
          .post("/applications")
          .set("Cookie", [cookie])
          .send({ position: "Engineer", companyName: `${companyName} ${randomUUID()}` })
          .expect(201);
        return res.body.id as string;
      };
      const schedule = async (applicationId: string, scheduledAt: string) => {
        const res = await request(server)
          .post(`/applications/${applicationId}/interviews`)
          .set("Cookie", [cookie])
          .send({ kind: "TECHNICAL", scheduledAt })
          .expect(201);
        return res.body.id as string;
      };

      const open = await newApplication("Open");
      const soon = await schedule(open, inDays(2));
      const later = await schedule(open, inDays(10));
      await schedule(open, inDays(-2));
      const cancelled = await schedule(open, inDays(1));
      await request(server).delete(`/applications/${open}/interviews/${cancelled}`).set("Cookie", [cookie]).expect(204);

      const rejected = await newApplication("Rejected");
      await schedule(rejected, inDays(1));
      await request(server).patch(`/applications/${rejected}`).set("Cookie", [cookie]).send({ status: "REJECTED" }).expect(200);

      const deleted = await newApplication("Deleted");
      await schedule(deleted, inDays(1));
      await request(server).delete(`/applications/${deleted}`).set("Cookie", [cookie]).expect(204);

      const week = await request(server).get("/interviews/upcoming").set("Cookie", [cookie]).expect(200);
      const weekItems = UpcomingInterviewSchema.array().parse(week.body);
      expect(weekItems.map((i) => i.id)).toEqual([soon]);
      expect(weekItems[0]?.application).toEqual(expect.objectContaining({ id: open, position: "Engineer" }));

      const twoWeeks = await request(server).get("/interviews/upcoming?days=14").set("Cookie", [cookie]).expect(200);
      expect(UpcomingInterviewSchema.array().parse(twoWeeks.body).map((i) => i.id)).toEqual([soon, later]);

      const other = await request(server).get("/interviews/upcoming").set("Cookie", [otherUserCookie]).expect(200);
      expect(other.body).toEqual([]);
    });

    it("validates the window and requires auth", async () => {
      const server = app.getHttpServer();
      await request(server).get("/interviews/upcoming?days=0").set("Cookie", [ownerCookie]).expect(400);
      await request(server).get("/interviews/upcoming?days=abc").set("Cookie", [ownerCookie]).expect(400);
      await request(server).get("/interviews/upcoming").expect(401);
    });
  });
});
