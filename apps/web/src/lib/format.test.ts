import { describe, expect, it } from "vitest";
import { formatSalary, formatWorkMode } from "./format";

const salary = { salaryMin: "60000.00", salaryMax: "75000.00", salaryCurrency: "EUR", salaryPeriod: "YEAR" } as const;

describe("formatSalary", () => {
  it("formats a range with the currency symbol and period", () => {
    expect(formatSalary(salary)).toBe("€60,000–€75,000 / year");
  });

  it("shows a single figure once and keeps cents", () => {
    expect(formatSalary({ ...salary, salaryMin: "45.50", salaryMax: "45.50", salaryCurrency: "USD", salaryPeriod: "HOUR" })).toBe(
      "$45.50 / hour",
    );
  });

  it("handles an open-ended range", () => {
    expect(formatSalary({ ...salary, salaryMax: null })).toBe("from €60,000 / year");
    expect(formatSalary({ ...salary, salaryMin: null, salaryPeriod: "MONTH" })).toBe("up to €75,000 / month");
  });

  it("falls back to the code for a currency Intl doesn't know", () => {
    expect(formatSalary({ ...salary, salaryMax: null, salaryCurrency: "XYZ" })).toMatch(/60,000/);
  });

  it("returns null without an amount", () => {
    expect(formatSalary({ salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null })).toBeNull();
  });
});

describe("formatWorkMode", () => {
  it("labels each mode", () => {
    expect(formatWorkMode("ONSITE")).toBe("On-site");
    expect(formatWorkMode("REMOTE")).toBe("Remote");
  });
});
