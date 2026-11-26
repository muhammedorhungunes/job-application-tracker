import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { ActivitySchema, ApplicationSchema, DueFollowUpSchema, FollowUpSchema } from "@job-tracker/types";
import { AppModule } from "../src/app.module";
import { pickCookie } from "./helpers";

/** Same prerequisites as applications.e2e-spec.ts (local Postgres + migrations). */
describe("Follow-ups (e2e)", () => {
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

  async function createApplication(cookie = ownerCookie): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/applications")
      .set("Cookie", [cookie])
      .send({ position: "Engineer", companyName: `E2E Co ${randomUUID()}` })
      .expect(201);
    return res.body.id as string;
  }

  async function getApplication(id: string) {
    const res = await request(app.getHttpServer()).get(`/applications/${id}`).set("Cookie", [ownerCookie]).expect(200);
    return ApplicationSchema.parse(res.body);
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
    await request(app.getHttpServer()).get("/applications/some-id/follow-ups").expect(401);
    await request(app.getHttpServer()).get("/follow-ups/due").expect(401);
  });

  it("plans, edits and completes a follow-up; only done touches the application", async () => {
    const server = app.getHttpServer();
    const applicationId = await createApplication();
    const base = `/applications/${applicationId}/follow-ups`;
    const before = await getApplication(applicationId);

    const contactRes = await request(server)
      .post(`/applications/${applicationId}/contacts`)
      .set("Cookie", [ownerCookie])
      .send({ name: "Jane Doe" })
      .expect(201);

    const createRes = await request(server)
      .post(base)
      .set("Cookie", [ownerCookie])
      .send({ dueDate: "2099-12-03", note: "  E-mail Jane again ", contactId: contactRes.body.id })
      .expect(201);
    const followUp = FollowUpSchema.parse(createRes.body);
    expect(followUp).toEqual(
      expect.objectContaining({
        dueDate: "2099-12-03",
        note: "E-mail Jane again",
        contact: { id: contactRes.body.id, name: "Jane Doe" },
        doneAt: null,
      }),
    );

    const updateRes = await request(server)
      .patch(`${base}/${followUp.id}`)
      .set("Cookie", [ownerCookie])
      .send({ dueDate: "2099-12-05", contactId: null })
      .expect(200);
    expect(updateRes.body).toEqual(expect.objectContaining({ dueDate: "2099-12-05", contact: null }));
    expect((await getApplication(applicationId)).updatedAt).toBe(before.updatedAt);

    const doneRes = await request(server).post(`${base}/${followUp.id}/done`).set("Cookie", [ownerCookie]).expect(200);
    expect(FollowUpSchema.parse(doneRes.body).doneAt).not.toBeNull();
    expect((await getApplication(applicationId)).updatedAt > before.updatedAt).toBe(true);

    const activities = ActivitySchema.array().parse(
      (await request(server).get(`/applications/${applicationId}/activities`).set("Cookie", [ownerCookie]).expect(200))
        .body,
    );
    expect(activities[0]).toEqual(
      expect.objectContaining({ type: "FOLLOW_UP_DONE", description: "Followed up: E-mail Jane again" }),
    );

    // Done is final: no editing or completing again, but it can be removed.
    await request(server).patch(`${base}/${followUp.id}`).set("Cookie", [ownerCookie]).send({ note: "X" }).expect(400);
    await request(server).post(`${base}/${followUp.id}/done`).set("Cookie", [ownerCookie]).expect(400);
    await request(server).delete(`${base}/${followUp.id}`).set("Cookie", [ownerCookie]).expect(204);
    const listRes = await request(server).get(base).set("Cookie", [ownerCookie]).expect(200);
    expect(listRes.body).toEqual([]);
  });

  it("lists open ones first by day, then done ones", async () => {
    const server = app.getHttpServer();
    const base = `/applications/${await createApplication()}/follow-ups`;
    const add = async (dueDate: string, note: string) =>
      FollowUpSchema.parse(
        (await request(server).post(base).set("Cookie", [ownerCookie]).send({ dueDate, note }).expect(201)).body,
      );

    const done = await add("2099-01-01", "done");
    await add("2099-03-01", "later");
    await add("2099-02-01", "sooner");
    await request(server).post(`${base}/${done.id}/done`).set("Cookie", [ownerCookie]).expect(200);

    const listRes = await request(server).get(base).set("Cookie", [ownerCookie]).expect(200);
    expect(FollowUpSchema.array().parse(listRes.body).map((f) => f.note)).toEqual(["sooner", "later", "done"]);
  });

  it("lists due follow-ups across applications, skipping future, done and closed ones", async () => {
    const server = app.getHttpServer();
    const cookie = await registerAndGetAccessCookie();
    const openId = await createApplication(cookie);
    const closedId = await createApplication(cookie);
    const add = async (applicationId: string, dueDate: string, note: string) =>
      FollowUpSchema.parse(
        (
          await request(server)
            .post(`/applications/${applicationId}/follow-ups`)
            .set("Cookie", [cookie])
            .send({ dueDate, note })
            .expect(201)
        ).body,
      );

    await add(openId, "2020-01-02", "overdue");
    await add(openId, "2099-01-01", "future");
    const done = await add(openId, "2020-01-01", "done");
    await request(server).post(`/applications/${openId}/follow-ups/${done.id}/done`).set("Cookie", [cookie]).expect(200);
    await add(closedId, "2020-01-01", "closed");
    await request(server).patch(`/applications/${closedId}`).set("Cookie", [cookie]).send({ status: "REJECTED" }).expect(200);

    const res = await request(server).get("/follow-ups/due").set("Cookie", [cookie]).expect(200);
    const due = DueFollowUpSchema.array().parse(res.body);
    expect(due.map((f) => f.note)).toEqual(["overdue"]);
    expect(due[0]?.application).toEqual(expect.objectContaining({ id: openId, position: "Engineer" }));
  });

  it("validates input", async () => {
    const server = app.getHttpServer();
    const applicationId = await createApplication();
    const base = `/applications/${applicationId}/follow-ups`;

    for (const body of [{}, { dueDate: "2099-02-31", note: "x" }, { dueDate: "2099-01-01", note: "  " }]) {
      await request(server).post(base).set("Cookie", [ownerCookie]).send(body).expect(400);
    }

    // A contact from another application can't be attached.
    const otherApplicationId = await createApplication();
    const contactRes = await request(server)
      .post(`/applications/${otherApplicationId}/contacts`)
      .set("Cookie", [ownerCookie])
      .send({ name: "Elsewhere" })
      .expect(201);
    await request(server)
      .post(base)
      .set("Cookie", [ownerCookie])
      .send({ dueDate: "2099-01-01", note: "x", contactId: contactRes.body.id })
      .expect(400);
  });

  it("hides another user's application", async () => {
    const server = app.getHttpServer();
    const base = `/applications/${await createApplication()}/follow-ups`;
    const created = await request(server)
      .post(base)
      .set("Cookie", [ownerCookie])
      .send({ dueDate: "2099-01-01", note: "mine" })
      .expect(201);

    await request(server).get(base).set("Cookie", [otherUserCookie]).expect(404);
    await request(server)
      .post(base)
      .set("Cookie", [otherUserCookie])
      .send({ dueDate: "2099-01-01", note: "x" })
      .expect(404);
    await request(server).post(`${base}/${created.body.id}/done`).set("Cookie", [otherUserCookie]).expect(404);
    await request(server).delete(`${base}/${created.body.id}`).set("Cookie", [otherUserCookie]).expect(404);
  });
});
