import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

/** Extracts a single cookie's `name=value` pair from a Set-Cookie header list. */
function pickCookie(setCookieHeader: string | string[] | undefined, name: string): string {
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const header = headers.find((c) => c.startsWith(`${name}=`));
  if (!header) {
    throw new Error(`Expected a "${name}" cookie in the response`);
  }
  return header.split(";")[0]!;
}

/**
 * Exercises the full register -> me -> refresh -> replay-detection -> logout
 * flow against a real (local) Postgres — requires DATABASE_URL to point at a
 * reachable database (see apps/api/.env.example / docker-compose.yml) and
 * `prisma migrate dev` to have run. Each run uses a fresh random email so
 * repeated runs don't collide on the unique constraint.
 */
describe("Auth flow (e2e)", () => {
  let app: INestApplication;
  const email = `${randomUUID()}@test.local`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers a user and sets auth cookies", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: "E2E User" })
      .expect(201);

    expect(res.body).toEqual({ id: expect.any(String), email, name: "E2E User" });
    expect(res.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("access_token="), expect.stringContaining("refresh_token=")]),
    );
  });

  it("rejects a duplicate registration", async () => {
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: "E2E User" })
      .expect(409);
  });

  it("runs the full session lifecycle: me -> refresh -> replay is rejected -> logout -> me fails", async () => {
    const server = app.getHttpServer();

    const loginRes = await request(server)
      .post("/auth/login")
      .send({ email, password: "password123" })
      .expect(200);
    const oldAccessCookie = pickCookie(loginRes.headers["set-cookie"], "access_token");
    const oldRefreshCookie = pickCookie(loginRes.headers["set-cookie"], "refresh_token");

    await request(server).get("/auth/me").set("Cookie", [oldAccessCookie]).expect(200);

    const refreshRes = await request(server)
      .post("/auth/refresh")
      .set("Cookie", [oldRefreshCookie])
      .expect(200);
    const newAccessCookie = pickCookie(refreshRes.headers["set-cookie"], "access_token");
    const newRefreshCookie = pickCookie(refreshRes.headers["set-cookie"], "refresh_token");

    await request(server).get("/auth/me").set("Cookie", [newAccessCookie]).expect(200);

    // Replaying the pre-rotation refresh cookie must be rejected. Per the
    // reuse-detection design this also burns every session for this user.
    await request(server).post("/auth/refresh").set("Cookie", [oldRefreshCookie]).expect(401);

    // The rotated (previously valid) refresh token is now revoked too, as a
    // side effect of the reuse detection above.
    await request(server).post("/auth/refresh").set("Cookie", [newRefreshCookie]).expect(401);

    await request(server).post("/auth/logout").set("Cookie", [newRefreshCookie]).expect(204);
    await request(server).get("/auth/me").set("Cookie", [newAccessCookie]).expect(200); // access token itself is still valid until it expires
  });
});
