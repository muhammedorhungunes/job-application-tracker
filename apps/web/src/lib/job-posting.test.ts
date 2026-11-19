import { describe, expect, it } from "vitest";
import type { JobPostingExtraction } from "@job-tracker/types";
import { extractionToFormValues } from "./job-posting";

const base = {
  companyName: "Acme Inc",
  position: "Backend Engineer",
  techStack: ["TypeScript", "PostgreSQL"],
  location: null,
  workMode: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryPeriod: null,
  url: null,
} satisfies JobPostingExtraction;

describe("extractionToFormValues", () => {
  it("maps company, position and tech stack", () => {
    expect(extractionToFormValues(base)).toEqual({
      companyName: "Acme Inc",
      position: "Backend Engineer",
      techStack: "TypeScript, PostgreSQL",
    });
  });

  it("keeps an http(s) URL and fills location and work mode", () => {
    const values = extractionToFormValues({
      ...base,
      url: "https://acme.example/jobs/1",
      location: "Berlin",
      workMode: "HYBRID",
    });

    expect(values).toMatchObject({ url: "https://acme.example/jobs/1", location: "Berlin", workMode: "HYBRID" });
    expect(values.notes).toBeUndefined();
  });

  it("fills a stated salary, upper-casing the currency", () => {
    const values = extractionToFormValues({
      ...base,
      salaryMin: 60000,
      salaryMax: 75000.5,
      salaryCurrency: "eur",
      salaryPeriod: "YEAR",
    });

    expect(values).toMatchObject({ salaryMin: "60000", salaryMax: "75000.5", salaryCurrency: "EUR", salaryPeriod: "YEAR" });
  });

  it("swaps a reversed range", () => {
    const values = extractionToFormValues({
      ...base,
      salaryMin: 80000,
      salaryMax: 60000,
      salaryCurrency: "USD",
      salaryPeriod: "YEAR",
    });

    expect(values).toMatchObject({ salaryMin: "60000", salaryMax: "80000" });
  });

  it("leaves the salary empty when the currency, period or amount is unusable", () => {
    const salary = { salaryMin: 60000, salaryMax: null, salaryCurrency: "EUR", salaryPeriod: "YEAR" } as const;

    for (const extraction of [
      { ...base, ...salary, salaryCurrency: "euros" },
      { ...base, ...salary, salaryPeriod: null },
      { ...base, ...salary, salaryMin: -5 },
    ]) {
      expect(extractionToFormValues(extraction).salaryMin).toBeUndefined();
    }
  });

  it("drops a URL that isn't http(s)", () => {
    expect(extractionToFormValues({ ...base, url: "acme.example/jobs" }).url).toBeUndefined();
  });
});
