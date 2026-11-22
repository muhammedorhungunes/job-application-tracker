import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { ActivitySchema, ApplicationSchema, ContactSchema } from "@job-tracker/types";
import { AppModule } from "../src/app.module";
import { pickCookie } from "./helpers";

/** Same prerequisites as applications.e2e-spec.ts (local Postgres + migrations). */
describe("Contacts (e2e)", () => {
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
    await request(app.getHttpServer()).get("/applications/some-id/contacts").expect(401);
  });

  it("adds, edits and removes a contact without touching the application", async () => {
    const server = app.getHttpServer();
    const applicationId = await createApplication();
    const base = `/applications/${applicationId}/contacts`;
    const before = ApplicationSchema.parse(
      (await request(server).get(`/applications/${applicationId}`).set("Cookie", [ownerCookie]).expect(200)).body,
    );

    const createRes = await request(server)
      .post(base)
      .set("Cookie", [ownerCookie])
      .send({ name: "  Jane Doe ", role: "Recruiter", email: "Jane@Acme.example" })
      .expect(201);
    const contact = ContactSchema.parse(createRes.body);
    expect(contact).toEqual(
      expect.objectContaining({ name: "Jane Doe", role: "Recruiter", email: "jane@acme.example", phone: null }),
    );

    const updateRes = await request(server)
      .patch(`${base}/${contact.id}`)
      .set("Cookie", [ownerCookie])
      .send({ role: null, linkedinUrl: "https://www.linkedin.com/in/jane-doe" })
      .expect(200);
    expect(updateRes.body).toEqual(
      expect.objectContaining({ role: null, linkedinUrl: "https://www.linkedin.com/in/jane-doe" }),
    );

    await request(server).post(base).set("Cookie", [ownerCookie]).send({ name: "Bob" }).expect(201);
    const listRes = await request(server).get(base).set("Cookie", [ownerCookie]).expect(200);
    expect(ContactSchema.array().parse(listRes.body).map((c) => c.name)).toEqual(["Jane Doe", "Bob"]);

    await request(server).delete(`${base}/${contact.id}`).set("Cookie", [ownerCookie]).expect(204);
    const afterDelete = await request(server).get(base).set("Cookie", [ownerCookie]).expect(200);
    expect(afterDelete.body.map((c: { name: string }) => c.name)).toEqual(["Bob"]);
    await request(server).delete(`${base}/${contact.id}`).set("Cookie", [ownerCookie]).expect(404);

    // Contacts are reference data: no timeline entries, no stale-reminder reset.
    const after = ApplicationSchema.parse(
      (await request(server).get(`/applications/${applicationId}`).set("Cookie", [ownerCookie]).expect(200)).body,
    );
    expect(after.updatedAt).toBe(before.updatedAt);
    const activities = ActivitySchema.array().parse(
      (await request(server).get(`/applications/${applicationId}/activities`).set("Cookie", [ownerCookie]).expect(200))
        .body,
    );
    expect(activities.map((a) => a.type)).toEqual(["APPLICATION_CREATED"]);
  });

  it("validates the body", async () => {
    const server = app.getHttpServer();
    const base = `/applications/${await createApplication()}/contacts`;

    await request(server).post(base).set("Cookie", [ownerCookie]).send({ name: "" }).expect(400);
    await request(server).post(base).set("Cookie", [ownerCookie]).send({ name: "Jane", email: "not-an-email" }).expect(400);
    await request(server)
      .post(base)
      .set("Cookie", [ownerCookie])
      .send({ name: "Jane", linkedinUrl: "javascript:alert(1)" })
      .expect(400);

    const created = await request(server).post(base).set("Cookie", [ownerCookie]).send({ name: "Jane" }).expect(201);
    await request(server).patch(`${base}/${created.body.id}`).set("Cookie", [ownerCookie]).send({}).expect(400);
  });

  it("hides contacts from other users", async () => {
    const server = app.getHttpServer();
    const base = `/applications/${await createApplication()}/contacts`;
    const created = await request(server).post(base).set("Cookie", [ownerCookie]).send({ name: "Jane" }).expect(201);

    await request(server).get(base).set("Cookie", [otherUserCookie]).expect(404);
    await request(server).post(base).set("Cookie", [otherUserCookie]).send({ name: "Mallory" }).expect(404);
    await request(server)
      .patch(`${base}/${created.body.id}`)
      .set("Cookie", [otherUserCookie])
      .send({ name: "Mallory" })
      .expect(404);
    await request(server).delete(`${base}/${created.body.id}`).set("Cookie", [otherUserCookie]).expect(404);

    const listRes = await request(server).get(base).set("Cookie", [ownerCookie]).expect(200);
    expect(listRes.body.map((c: { name: string }) => c.name)).toEqual(["Jane"]);
  });
});
