import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiFetchWithCookies, ApiError } from "./api-client";

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed JSON body on success", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<{ status: string }>("/health");

    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/health",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("throws an ApiError with the response status on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unauthorized", { status: 401 })),
    );

    await expect(apiFetch("/auth/me")).rejects.toThrow(ApiError);
  });

  it("returns undefined for a 204 No Content response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );

    const result = await apiFetch("/auth/logout", { method: "POST" });

    expect(result).toBeUndefined();
  });

  it("returns the Set-Cookie lines alongside the body", async () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "access_token=abc; Max-Age=900; Path=/; HttpOnly");
    headers.append("Set-Cookie", "refresh_token=def; Max-Age=2592000; Path=/auth; HttpOnly");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "u1" }), { status: 200, headers })),
    );

    const result = await apiFetchWithCookies<{ id: string }>("/auth/login", { method: "POST" });

    expect(result.data).toEqual({ id: "u1" });
    expect(result.setCookies).toEqual([
      "access_token=abc; Max-Age=900; Path=/; HttpOnly",
      "refresh_token=def; Max-Age=2592000; Path=/auth; HttpOnly",
    ]);
  });
});
