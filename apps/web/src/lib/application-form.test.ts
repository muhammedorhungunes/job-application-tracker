import { describe, expect, it } from "vitest";
import type { Application } from "@job-tracker/types";
import {
  amountToInput,
  formatTechStack,
  isoToDateInput,
  parseCreateApplicationForm,
  parseTechStack,
  parseUpdateApplicationForm,
} from "./application-form";

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
  techStack: ["TypeScript"],
  location: "Berlin",
  workMode: "HYBRID",
  salaryMin: "60000.00",
  salaryMax: "75000.00",
  salaryCurrency: "EUR",
  salaryPeriod: "YEAR",
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
  techStack: "TypeScript",
  location: "Berlin",
  workMode: "HYBRID",
  salaryMin: "60000",
  salaryMax: "75000",
  salaryCurrency: "EUR",
  salaryPeriod: "YEAR",
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
    expect(result.data?.techStack).toBeUndefined();
  });

  it("passes location, work mode and salary through, upper-casing the currency", () => {
    const result = parseCreateApplicationForm(
      formData({
        position: "Dev",
        companyName: "Acme",
        location: "Berlin",
        workMode: "REMOTE",
        salaryMin: "60000",
        salaryMax: "75000.50",
        salaryCurrency: "eur",
        salaryPeriod: "YEAR",
      }),
    );

    expect(result.data).toEqual(
      expect.objectContaining({
        location: "Berlin",
        workMode: "REMOTE",
        salaryMin: "60000",
        salaryMax: "75000.50",
        salaryCurrency: "EUR",
        salaryPeriod: "YEAR",
      }),
    );
  });

  it("treats an empty work mode as not provided", () => {
    const result = parseCreateApplicationForm(formData({ position: "Dev", companyName: "Acme", workMode: "" }));

    expect(result.success).toBe(true);
    expect(result.data?.workMode).toBeUndefined();
  });

  it("rejects a maximum below the minimum and a malformed amount", () => {
    const reversed = parseCreateApplicationForm(
      formData({ position: "Dev", companyName: "Acme", salaryMin: "80000", salaryMax: "60000", salaryCurrency: "EUR", salaryPeriod: "YEAR" }),
    );
    expect(reversed.error?.flatten().fieldErrors.salaryMax).toBeDefined();

    const malformed = parseCreateApplicationForm(
      formData({ position: "Dev", companyName: "Acme", salaryMin: "60,000", salaryCurrency: "EUR", salaryPeriod: "YEAR" }),
    );
    expect(malformed.error?.flatten().fieldErrors.salaryMin).toBeDefined();
  });

  it("splits the tech stack input into a list", () => {
    const result = parseCreateApplicationForm(
      formData({ position: "Dev", companyName: "Acme", techStack: "TypeScript, PostgreSQL" }),
    );

    expect(result.data?.techStack).toEqual(["TypeScript", "PostgreSQL"]);
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

  it("sends the new tech stack when it changed", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, techStack: "TypeScript, Go" }), current);

    expect(result.data).toEqual({ techStack: ["TypeScript", "Go"] });
  });

  it("sends an empty tech stack when the input is cleared", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, techStack: "" }), current);

    expect(result.data).toEqual({ techStack: [] });
  });

  it("sends null for a cleared location and work mode", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, location: "", workMode: "" }), current);

    expect(result.data).toEqual({ location: null, workMode: null });
  });

  it("treats 60000 and the stored 60000.00 as unchanged", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, salaryMin: "60000.00" }), current);

    expect(result.success).toBe(false);
  });

  it("sends all four salary fields when one of them changed", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, salaryPeriod: "MONTH" }), current);

    expect(result.data).toEqual({ salaryMin: "60000", salaryMax: "75000", salaryCurrency: "EUR", salaryPeriod: "MONTH" });
  });

  it("checks the whole salary, e.g. a new maximum below the minimum", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, salaryMax: "50000" }), current);

    expect(result.error?.flatten().fieldErrors.salaryMax).toBeDefined();
  });

  it("clears the salary when both amounts are emptied", () => {
    const result = parseUpdateApplicationForm(formData({ ...unchangedForm, salaryMin: "", salaryMax: "" }), current);

    expect(result.data).toEqual({ salaryMin: null, salaryMax: null, salaryCurrency: "EUR", salaryPeriod: "YEAR" });
  });

  it("ignores currency and period changes while there is no amount", () => {
    const noSalary = { ...current, salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null };
    const result = parseUpdateApplicationForm(
      formData({ ...unchangedForm, salaryMin: "", salaryMax: "", salaryCurrency: "EUR", salaryPeriod: "YEAR" }),
      noSalary,
    );

    expect(result.success).toBe(false);
    expect(result.error?.flatten().formErrors).toEqual(["Provide at least one field to update"]);
  });

  it("fails when nothing changed", () => {
    const result = parseUpdateApplicationForm(formData(unchangedForm), current);

    expect(result.success).toBe(false);
    expect(result.error?.flatten().formErrors).toEqual(["Provide at least one field to update"]);
  });
});

describe("amountToInput", () => {
  it("drops .00 but keeps cents", () => {
    expect(amountToInput("60000.00")).toBe("60000");
    expect(amountToInput("60000.50")).toBe("60000.50");
    expect(amountToInput(null)).toBe("");
  });
});

describe("isoToDateInput", () => {
  it("returns the UTC calendar date or an empty string", () => {
    expect(isoToDateInput("2026-09-01T14:30:00.000Z")).toBe("2026-09-01");
    expect(isoToDateInput(null)).toBe("");
  });
});

describe("parseTechStack", () => {
  it("trims items and drops blanks and case-insensitive duplicates", () => {
    expect(parseTechStack(" TypeScript ,, typescript, AWS ,")).toEqual(["TypeScript", "AWS"]);
  });

  it("round-trips with formatTechStack", () => {
    expect(parseTechStack(formatTechStack(["Go", "Redis"]))).toEqual(["Go", "Redis"]);
  });
});
