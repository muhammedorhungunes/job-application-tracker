import { describe, expect, it } from "vitest";
import { buildAuthCookieHeader, parseAuthSetCookies } from "./auth-cookies";

describe("parseAuthSetCookies", () => {
  it("extracts name, value and Max-Age of the auth cookies", () => {
    const result = parseAuthSetCookies([
      "access_token=eyJ.abc.def; Max-Age=900; Path=/; Expires=Sun, 18 Oct 2026 12:15:00 GMT; HttpOnly; SameSite=Lax",
      "refresh_token=r%2Ftoken; Max-Age=2592000; Path=/auth; HttpOnly",
    ]);

    expect(result).toEqual([
      { name: "access_token", value: "eyJ.abc.def", maxAge: 900 },
      { name: "refresh_token", value: "r/token", maxAge: 2592000 },
    ]);
  });

  it("ignores unrelated and malformed cookies", () => {
    expect(parseAuthSetCookies(["other=1; Path=/", "garbage", "=nameless"])).toEqual([]);
  });

  it("leaves maxAge undefined when the attribute is missing or invalid", () => {
    expect(parseAuthSetCookies(["access_token=a; Path=/", "refresh_token=b; Max-Age=soon"])).toEqual([
      { name: "access_token", value: "a", maxAge: undefined },
      { name: "refresh_token", value: "b", maxAge: undefined },
    ]);
  });
});

describe("buildAuthCookieHeader", () => {
  it("joins the cookies that are present", () => {
    const values: Record<string, string> = { access_token: "a", refresh_token: "b" };
    expect(buildAuthCookieHeader((name) => values[name])).toBe("access_token=a; refresh_token=b");
  });

  it("returns undefined when no auth cookie is present", () => {
    expect(buildAuthCookieHeader(() => undefined)).toBeUndefined();
  });
});
