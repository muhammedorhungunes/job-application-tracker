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

  describe("notes", () => {
    async function createApplication(): Promise<{ id: string; updatedAt: string }> {
      const res = await request(app.getHttpServer())
        .post("/applications")
        .set("Cookie", [ownerCookie])
        .send({ position: "Engineer", companyName: `E2E Co ${randomUUID()}` })
        .expect(201);
      return res.body as { id: string; updatedAt: string };
    }

    it("adds a note to the timeline, bumps updatedAt, and deletes it again", async () => {
      const server = app.getHttpServer();
      const created = await createApplication();

      const noteRes = await request(server)
        .post(`/applications/${created.id}/notes`)
        .set("Cookie", [ownerCookie])
        .send({ text: "  Called the recruiter  " })
        .expect(201);
      const note = ActivitySchema.parse(noteRes.body);
      expect(note).toEqual(expect.objectContaining({ type: "NOTE", description: "Called the recruiter" }));

      const appRes = await request(server).get(`/applications/${created.id}`).set("Cookie", [ownerCookie]).expect(200);
      expect(new Date(appRes.body.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());

      let activities = await request(server)
        .get(`/applications/${created.id}/activities`)
        .set("Cookie", [ownerCookie])
        .expect(200);
      expect(activities.body.map((a: { type: string }) => a.type)).toEqual(["NOTE", "APPLICATION_CREATED"]);

      await request(server)
        .delete(`/applications/${created.id}/notes/${note.id}`)
        .set("Cookie", [ownerCookie])
        .expect(204);
      activities = await request(server)
        .get(`/applications/${created.id}/activities`)
        .set("Cookie", [ownerCookie])
        .expect(200);
      expect(activities.body.map((a: { type: string }) => a.type)).toEqual(["APPLICATION_CREATED"]);

      // Already deleted.
      await request(server)
        .delete(`/applications/${created.id}/notes/${note.id}`)
        .set("Cookie", [ownerCookie])
        .expect(404);
    });

    it("won't delete system history through the notes route", async () => {
      const server = app.getHttpServer();
      const created = await createApplication();
      const activities = await request(server)
        .get(`/applications/${created.id}/activities`)
        .set("Cookie", [ownerCookie])
        .expect(200);

      await request(server)
        .delete(`/applications/${created.id}/notes/${activities.body[0].id}`)
        .set("Cookie", [ownerCookie])
        .expect(404);
    });

    it("rejects an empty note and hides notes from other users", async () => {
      const server = app.getHttpServer();
      const created = await createApplication();

      await request(server)
        .post(`/applications/${created.id}/notes`)
        .set("Cookie", [ownerCookie])
        .send({ text: "   " })
        .expect(400);
      await request(server)
        .post(`/applications/${created.id}/notes`)
        .set("Cookie", [otherUserCookie])
        .send({ text: "Not mine" })
        .expect(404);
    });
  });

  describe("filters and tech stack options", () => {
    // A fresh user so the owner's applications from other tests don't leak in.
    let cookie: string;
    const tag = randomUUID().slice(0, 8);
    const ids: Record<string, string> = {};

    async function create(key: string, body: Record<string, unknown>): Promise<void> {
      const res = await request(app.getHttpServer())
        .post("/applications")
        .set("Cookie", [cookie])
        .send({ position: "Engineer", companyName: `Co ${tag} ${key}`, ...body })
        .expect(201);
      ids[key] = res.body.id;
    }

    async function list(query: string): Promise<string[]> {
      const res = await request(app.getHttpServer()).get(`/applications?${query}`).set("Cookie", [cookie]).expect(200);
      return (res.body as { id: string }[]).map((a) => a.id).sort();
    }

    const pick = (...keys: string[]) => keys.map((key) => ids[key]!).sort();

    beforeAll(async () => {
      cookie = await registerAndGetAccessCookie();
      await create("frontend", {
        position: "Frontend Developer",
        companyName: `Globex ${tag}`,
        techStack: ["React", "TypeScript"],
        appliedAt: "2026-09-15T10:00:00.000Z",
      });
      await create("backend", {
        position: "Backend Engineer",
        status: "INTERVIEWING",
        techStack: ["Go"],
        appliedAt: "2026-10-31T23:30:00.000Z",
      });
      // No appliedAt: the date filter falls back to createdAt (today).
      await create("undated", { position: "Platform Engineer", status: "OFFER", techStack: ["react"] });
    });

    it("lists everything without filters", async () => {
      expect(await list("")).toEqual(pick("frontend", "backend", "undated"));
    });

    it("searches position and company name case-insensitively", async () => {
      expect(await list("q=frontend")).toEqual(pick("frontend"));
      expect(await list(`q=GLOBEX%20${tag}`)).toEqual(pick("frontend"));
      expect(await list("q=engineer")).toEqual(pick("backend", "undated"));
    });

    it("treats LIKE wildcards in the search literally", async () => {
      expect(await list("q=%25")).toEqual([]);
      expect(await list("q=_")).toEqual([]);
    });

    it("filters by one or more statuses", async () => {
      expect(await list("status=OFFER")).toEqual(pick("undated"));
      expect(await list("status=APPLIED&status=INTERVIEWING")).toEqual(pick("frontend", "backend"));
    });

    it("filters by an exact tech stack entry", async () => {
      expect(await list("tech=React")).toEqual(pick("frontend"));
      expect(await list("tech=react")).toEqual(pick("undated"));
    });

    it("filters by inclusive UTC days, falling back to createdAt", async () => {
      expect(await list("from=2026-09-01&to=2026-10-31")).toEqual(pick("frontend", "backend"));
      expect(await list("from=2026-11-01&to=2026-11-01")).toEqual([]);
      const today = new Date().toISOString().slice(0, 10);
      expect(await list(`from=${today}`)).toEqual(pick("undated"));
    });

    it("combines filters with AND and ignores empty form fields", async () => {
      expect(await list("q=engineer&status=OFFER&tech=&from=&to=")).toEqual(pick("undated"));
    });

    it("rejects invalid filters", async () => {
      const server = app.getHttpServer();
      for (const query of ["status=NOPE", "from=2026-02-31", "from=2026-11-02&to=2026-11-01"]) {
        await request(server).get(`/applications?${query}`).set("Cookie", [cookie]).expect(400);
      }
    });

    it("doesn't return other users' applications", async () => {
      const res = await request(app.getHttpServer())
        .get(`/applications?q=${tag}`)
        .set("Cookie", [otherUserCookie])
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it("returns distinct tech stack entries for the user only", async () => {
      const res = await request(app.getHttpServer()).get("/applications/tech-stack").set("Cookie", [cookie]).expect(200);
      expect(res.body).toEqual(["Go", "react", "React", "TypeScript"]);
    });
  });
});
