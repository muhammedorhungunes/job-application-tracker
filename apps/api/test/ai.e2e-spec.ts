import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { ANTHROPIC_CLIENT } from "../src/ai/ai.client";
import { pickCookie } from "./helpers";

/**
 * /ai/job-postings against real Postgres and Redis (the BullMQ worker really
 * runs). Only the Anthropic client is faked, so no API call or cost.
 */
describe("AI job postings (e2e)", () => {
  let app: INestApplication;
  let ownerCookie: string;
  let otherUserCookie: string;

  const extraction = {
    companyName: "Acme Inc",
    position: "Backend Engineer",
    techStack: ["TypeScript", "PostgreSQL"],
    location: "Remote",
    url: null,
  };
  const parse = jest.fn().mockResolvedValue({
    model: "claude-opus-5-5",
    stop_reason: "end_turn",
    usage: { input_tokens: 500, output_tokens: 40 },
    parsed_output: extraction,
  });

  const postingText = "Acme Inc is hiring a Backend Engineer. You will work with TypeScript and PostgreSQL. Remote.";

  async function registerAndGetAccessCookie(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email: `${randomUUID()}@test.local`, password: "password123", name: "E2E User" })
      .expect(201);
    return pickCookie(res.headers["set-cookie"], "access_token");
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ANTHROPIC_CLIENT)
      .useValue({ beta: { messages: { parse } } })
      .compile();
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
    await request(app.getHttpServer()).post("/ai/job-postings").send({ text: postingText }).expect(401);
  });

  it("rejects a posting that is too short", async () => {
    await request(app.getHttpServer())
      .post("/ai/job-postings")
      .set("Cookie", [ownerCookie])
      .send({ text: "too short" })
      .expect(400);
  });

  // Every e2e suite boots its own AppModule, so each one also starts a BullMQ
  // worker on the same queue. test:e2e runs --runInBand so only this suite's
  // worker (with the faked client) is alive to pick the job up.
  it("accepts a posting, processes it in the queue, and returns the extraction", async () => {
    const server = app.getHttpServer();

    const createRes = await request(server)
      .post("/ai/job-postings")
      .set("Cookie", [ownerCookie])
      .send({ text: postingText })
      .expect(202);
    expect(createRes.body).toEqual(expect.objectContaining({ status: "PENDING", result: null }));
    const id: string = createRes.body.id;

    let body: { status: string; result: unknown } = createRes.body;
    for (let i = 0; i < 50 && body.status === "PENDING"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      body = (await request(server).get(`/ai/job-postings/${id}`).set("Cookie", [ownerCookie]).expect(200)).body;
    }

    expect(body).toEqual(expect.objectContaining({ status: "COMPLETED", result: extraction }));
    expect(parse).toHaveBeenCalled();
  });

  it("returns 404 for another user's parse", async () => {
    const server = app.getHttpServer();
    const createRes = await request(server)
      .post("/ai/job-postings")
      .set("Cookie", [ownerCookie])
      .send({ text: postingText })
      .expect(202);

    await request(server).get(`/ai/job-postings/${createRes.body.id}`).set("Cookie", [otherUserCookie]).expect(404);
  });
});
