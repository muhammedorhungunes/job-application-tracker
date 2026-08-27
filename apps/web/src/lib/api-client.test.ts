import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./api-client";

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
});
