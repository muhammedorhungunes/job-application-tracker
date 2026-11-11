import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { UserSettingsSchema } from "@job-tracker/types";
import { AppModule } from "../src/app.module";
import { AppConfigService } from "../src/config/app-config.service";
import { pickCookie } from "./helpers";

/** GET/PATCH /settings against a real (local) Postgres, same prerequisites as auth.e2e-spec.ts. */
describe("Settings (e2e)", () => {
  let app: INestApplication;
  let config: AppConfigService;
  let cookie: string;
  let email: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    config = app.get(AppConfigService);

    email = `${randomUUID()}@test.local`;
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: "Settings User" })
      .expect(201);
    cookie = pickCookie(res.headers["set-cookie"], "access_token");
  });

  afterAll(async () => {
    await app.close();
  });

  const patch = (body: unknown) =>
    request(app.getHttpServer()).patch("/settings").set("Cookie", [cookie]).send(body as object);

  it("requires an access token", async () => {
    await request(app.getHttpServer()).get("/settings").expect(401);
    await request(app.getHttpServer()).patch("/settings").send({ name: "X" }).expect(401);
  });

  it("starts with no overrides and both reminders on", async () => {
    const res = await request(app.getHttpServer()).get("/settings").set("Cookie", [cookie]).expect(200);

    expect(UserSettingsSchema.parse(res.body)).toEqual({
      name: "Settings User",
      email,
      timeZone: null,
      staleDigestEnabled: true,
      staleDays: null,
      interviewRemindersEnabled: true,
      defaults: { timeZone: config.reminderTz, staleDays: config.reminderStaleDays },
    });
  });

  it("updates each setting, canonicalises the zone, and persists it", async () => {
    const res = await patch({
      name: "  Renamed  ",
      timeZone: "america/new_york",
      staleDigestEnabled: false,
      staleDays: 14,
      interviewRemindersEnabled: false,
    }).expect(200);
    expect(res.body).toMatchObject({
      name: "Renamed",
      timeZone: "America/New_York",
      staleDigestEnabled: false,
      staleDays: 14,
      interviewRemindersEnabled: false,
    });

    const again = await request(app.getHttpServer()).get("/settings").set("Cookie", [cookie]).expect(200);
    expect(again.body).toEqual(res.body);

    const me = await request(app.getHttpServer()).get("/auth/me").set("Cookie", [cookie]).expect(200);
    expect(me.body.name).toBe("Renamed");
  });

  it("resets overrides to the default with null and leaves omitted fields alone", async () => {
    const res = await patch({ timeZone: null, staleDays: null }).expect(200);
    expect(res.body).toMatchObject({ timeZone: null, staleDays: null, name: "Renamed", staleDigestEnabled: false });
  });

  it("rejects invalid input", async () => {
    for (const body of [
      {},
      { timeZone: "Mars/Olympus" },
      { staleDays: 0 },
      { staleDays: 91 },
      { staleDays: 1.5 },
      { name: "   " },
      { staleDigestEnabled: "no" },
      { email: "new@test.local" },
    ]) {
      await patch(body).expect(400);
    }
  });
});
