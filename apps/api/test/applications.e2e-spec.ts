import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
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
});
