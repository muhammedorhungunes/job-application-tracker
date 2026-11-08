import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { ActivitySchema, ApplicationStatsSchema } from "@job-tracker/types";
import { AppModule } from "../src/app.module";
import { pickCookie } from "./helpers";

/**
 * Full CRUD lifecycle for /applications against a real (local) Postgres —
 * same prerequisites as auth.e2e-spec.ts (DATABASE_URL + migrations applied).
 */
describe("Applications (e2e)", () => {
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
    await request(app.getHttpServer()).get("/applications").expect(401);
  });

  it("rejects an invalid create body", async () => {
    await request(app.getHttpServer())
      .post("/applications")
      .set("Cookie", [ownerCookie])
      .send({ position: "" })
      .expect(400);
  });

  it("runs the full lifecycle: create -> list -> get -> patch -> delete -> get 404", async () => {
    const server = app.getHttpServer();

    const createRes = await request(server)
      .post("/applications")
      .set("Cookie", [ownerCookie])
      .send({
        position: "Backend Engineer",
        companyName: `E2E Co ${randomUUID()}`,
        url: "https://example.com/job",
        techStack: ["TypeScript"],
      })
      .expect(201);
    const id: string = createRes.body.id;
    expect(createRes.body).toEqual(
      expect.objectContaining({
        position: "Backend Engineer",
        status: "APPLIED",
        url: "https://example.com/job",
        techStack: ["TypeScript"],
      }),
    );

    const listRes = await request(server).get("/applications").set("Cookie", [ownerCookie]).expect(200);
    expect(listRes.body).toEqual([expect.objectContaining({ id })]);

    await request(server).get(`/applications/${id}`).set("Cookie", [ownerCookie]).expect(200);

    const patchRes = await request(server)
      .patch(`/applications/${id}`)
      .set("Cookie", [ownerCookie])
      .send({ status: "INTERVIEWING", url: null })
      .expect(200);
    expect(patchRes.body).toEqual(expect.objectContaining({ status: "INTERVIEWING", url: null }));

    await request(server).delete(`/applications/${id}`).set("Cookie", [ownerCookie]).expect(204);
    await request(server).get(`/applications/${id}`).set("Cookie", [ownerCookie]).expect(404);

    const listAfterDelete = await request(server).get("/applications").set("Cookie", [ownerCookie]).expect(200);
    expect(listAfterDelete.body).toEqual([]);
  });

  it("hides one user's application from another user", async () => {
    const server = app.getHttpServer();

    const createRes = await request(server)
      .post("/applications")
      .set("Cookie", [ownerCookie])
      .send({ position: "Frontend Engineer", companyName: `E2E Co ${randomUUID()}` })
      .expect(201);
    const id: string = createRes.body.id;

    await request(server).get(`/applications/${id}`).set("Cookie", [otherUserCookie]).expect(404);
    await request(server)
      .patch(`/applications/${id}`)
      .set("Cookie", [otherUserCookie])
      .send({ status: "OFFER" })
      .expect(404);
    await request(server).delete(`/applications/${id}`).set("Cookie", [otherUserCookie]).expect(404);

    const otherList = await request(server).get("/applications").set("Cookie", [otherUserCookie]).expect(200);
    expect(otherList.body).toEqual([]);
  });

  describe("GET /applications/stats", () => {
    it("rejects requests without an access token", async () => {
      await request(app.getHttpServer()).get("/applications/stats").expect(401);
    });

    it("summarizes only the caller's non-deleted applications", async () => {
      const server = app.getHttpServer();
      // Fresh users: the shared ones above already own applications.
      const statsUser = await registerAndGetAccessCookie();
      const bystander = await registerAndGetAccessCookie();

      async function create(cookie: string, body: Record<string, unknown>): Promise<string> {
        const res = await request(server)
          .post("/applications")
          .set("Cookie", [cookie])
          .send({ position: "Engineer", companyName: `E2E Co ${randomUUID()}`, ...body })
          .expect(201);
        return res.body.id as string;
      }

      await create(statsUser, {});
      await create(statsUser, { status: "INTERVIEWING" });
      await create(statsUser, { status: "OFFER" });
      const deletedId = await create(statsUser, { status: "REJECTED" });
      await request(server).delete(`/applications/${deletedId}`).set("Cookie", [statsUser]).expect(204);
      await create(bystander, { status: "REJECTED" });

      const res = await request(server).get("/applications/stats").set("Cookie", [statsUser]).expect(200);
      const stats = ApplicationStatsSchema.parse(res.body);

      expect(stats.total).toBe(3);
      expect(stats.byStatus).toEqual({ APPLIED: 1, INTERVIEWING: 1, OFFER: 1, REJECTED: 0, WITHDRAWN: 0 });
      expect(stats.weekly.at(-1)!.count).toBe(3);
      expect(stats.conversion.interviewRate).toBeCloseTo(2 / 3);
      expect(stats.conversion.offerFromInterviewRate).toBe(0.5);
      // Everything was just created, so nothing is stale yet.
      expect(stats.stale.count).toBe(0);
    });

    it("counts statuses an application passed through, not only its current one", async () => {
      const server = app.getHttpServer();
      const statsUser = await registerAndGetAccessCookie();

      const createRes = await request(server)
        .post("/applications")
        .set("Cookie", [statsUser])
        .send({ position: "Engineer", companyName: `E2E Co ${randomUUID()}`, status: "INTERVIEWING" })
        .expect(201);
      await request(server)
        .patch(`/applications/${createRes.body.id}`)
        .set("Cookie", [statsUser])
        .send({ status: "REJECTED" })
        .expect(200);

      const res = await request(server).get("/applications/stats").set("Cookie", [statsUser]).expect(200);
      const stats = ApplicationStatsSchema.parse(res.body);

      expect(stats.byStatus.REJECTED).toBe(1);
      expect(stats.conversion.interviewRate).toBe(1);
      expect(stats.conversion.offerRate).toBe(0);
    });
  });

  describe("GET /applications/:id/activities", () => {
    it("records creation and each real status change, newest first", async () => {
      const server = app.getHttpServer();
      const createRes = await request(server)
        .post("/applications")
        .set("Cookie", [ownerCookie])
        .send({ position: "Engineer", companyName: `E2E Co ${randomUUID()}` })
        .expect(201);
      const id: string = createRes.body.id;

      for (const status of ["INTERVIEWING", "INTERVIEWING", "OFFER"]) {
        await request(server).patch(`/applications/${id}`).set("Cookie", [ownerCookie]).send({ status }).expect(200);
      }
      // Non-status edits don't add entries either.
      await request(server).patch(`/applications/${id}`).set("Cookie", [ownerCookie]).send({ notes: "Hi" }).expect(200);

      const res = await request(server).get(`/applications/${id}/activities`).set("Cookie", [ownerCookie]).expect(200);
      const activities = ActivitySchema.array().parse(res.body);

      // The repeated INTERVIEWING was a no-op, so 3 entries, not 4.
      expect(activities.map(({ type, fromStatus, toStatus }) => ({ type, fromStatus, toStatus }))).toEqual([
        { type: "STATUS_CHANGE", fromStatus: "INTERVIEWING", toStatus: "OFFER" },
        { type: "STATUS_CHANGE", fromStatus: "APPLIED", toStatus: "INTERVIEWING" },
        { type: "APPLICATION_CREATED", fromStatus: null, toStatus: "APPLIED" },
      ]);
    });

    it("returns 404 for another user's application", async () => {
      const server = app.getHttpServer();
      const createRes = await request(server)
        .post("/applications")
        .set("Cookie", [ownerCookie])
        .send({ position: "Engineer", companyName: `E2E Co ${randomUUID()}` })
        .expect(201);

      await request(server)
        .get(`/applications/${createRes.body.id}/activities`)
        .set("Cookie", [otherUserCookie])
        .expect(404);
    });
  });
});
