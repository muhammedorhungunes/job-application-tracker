import { describe, expect, it } from "vitest";
import type { Application } from "@job-tracker/types";
import { isoToDateInput, parseCreateApplicationForm, parseUpdateApplicationForm } from "./application-form";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

const current: Application = {
  id: "app-1",
  position: "Backend Engineer",
  status: "APPLIED",
  source: "LinkedIn",
  url: "https://example.com/job",
  appliedAt: "2026-09-01T14:30:00.000Z",
  notes: null,
  createdAt: "2026-09-01T14:30:00.000Z",
  updatedAt: "2026-09-01T14:30:00.000Z",
  company: { id: "company-1", name: "Acme Inc" },
};

const unchangedForm = {
  position: "Backend Engineer",
  companyName: "Acme Inc",
  status: "APPLIED",
  source: "LinkedIn",
  url: "https://example.com/job",
  appliedAt: "2026-09-01",
  notes: "",
};

describe("parseCreateApplicationForm", () => {
  it("drops empty optional fields and converts the date to ISO", () => {
    const result = parseCreateApplicationForm(
      formData({ position: " Backend Engineer ", companyName: "Acme", status: "APPLIED", source: "", url: "", notes: "", appliedAt: "2026-10-18" }),
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        position: "Backend Engineer",
        companyName: "Acme",
        status: "APPLIED",
        appliedAt: "2026-10-18T00:00:00.000Z",
      }),
    );
    expect(result.data?.source).toBeUndefined();
    expect(result.data?.url).toBeUndefined();
  });

  it("reports missing required fields", () => {
    const result = parseCreateApplicationForm(formData({ position: "", companyName: "" }));

    expect(result.success).toBe(false);
    expect(Object.keys(result.error?.flatten().fieldErrors ?? {})).toEqual(["position", "companyName"]);
  });

  it("rejects an invalid URL", () => {
    const result = parseCreateApplicationForm(formData({ position: "Dev", companyName: "Acme", url: "not a url" }));

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.url).toBeDefined();
  });
});

describe("parseUpdateApplicationForm", () => {
  it("sends only the changed fields", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, status: "INTERVIEWING" }), current);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ status: "INTERVIEWING" });
  });

  it("sends null for a cleared optional field", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, url: "", appliedAt: "" }), current);

    expect(result.data).toEqual({ url: null, appliedAt: null });
  });

  it("keeps an untouched date even though the stored value has a time of day", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, appliedAt: "2026-09-05" }), current);

    expect(result.data).toEqual({ appliedAt: "2026-09-05T00:00:00.000Z" });
  });

  it("fails when nothing changed", () => {
    const result = parseUpdateApplicationForm(formData(unchangedForm), current);

    expect(result.success).toBe(false);
    expect(result.error?.flatten().formErrors).toEqual(["Provide at least one field to update"]);
  });
});

describe("isoToDateInput", () => {
  it("returns the UTC calendar date or an empty string", () => {
    expect(isoToDateInput("2026-09-01T14:30:00.000Z")).toBe("2026-09-01");
    expect(isoToDateInput(null)).toBe("");
  });
});
