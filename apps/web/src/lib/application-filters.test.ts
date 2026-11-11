import { describe, expect, it } from "vitest";
import { hasActiveFilters, parseFilters, toQueryString } from "./application-filters";

describe("parseFilters", () => {
  it("returns no filters for an empty URL", () => {
    expect(parseFilters({})).toEqual({});
  });

  it("parses every filter, accepting a single or repeated status", () => {
    expect(parseFilters({ q: " acme ", status: "OFFER", tech: "Go", from: "2026-11-01", to: "2026-11-30" })).toEqual({
      q: "acme",
      status: ["OFFER"],
      tech: "Go",
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(parseFilters({ status: ["APPLIED", "OFFER"] }).status).toEqual(["APPLIED", "OFFER"]);
  });

  it("treats empty form fields as no filter", () => {
    expect(parseFilters({ q: "", tech: "", from: "", to: "" })).toEqual({});
  });

  it("drops invalid fields but keeps the valid ones", () => {
    expect(parseFilters({ q: "acme", status: "NOPE", from: "2026-02-31" })).toEqual({ q: "acme" });
    expect(parseFilters({ tech: "Go", from: "2026-11-02", to: "2026-11-01" })).toEqual({ tech: "Go", from: "2026-11-02" });
  });

  it("ignores unknown params", () => {
    expect(parseFilters({ page: "2", q: "acme" })).toEqual({ q: "acme" });
  });
});

describe("toQueryString / hasActiveFilters", () => {
  it("is empty without filters", () => {
    expect(toQueryString({})).toBe("");
    expect(hasActiveFilters({})).toBe(false);
  });

  it("encodes values and repeats status, and round-trips through parseFilters", () => {
    const filters = { q: "c++ & co", status: ["APPLIED" as const, "OFFER" as const], tech: "Node.js", to: "2026-11-30" };
    const query = toQueryString(filters);

    expect(query).toBe("?q=c%2B%2B+%26+co&status=APPLIED&status=OFFER&tech=Node.js&to=2026-11-30");
    expect(hasActiveFilters(filters)).toBe(true);

    const params = new URLSearchParams(query);
    expect(parseFilters({ ...Object.fromEntries(params), status: params.getAll("status") })).toEqual(filters);
  });
});
