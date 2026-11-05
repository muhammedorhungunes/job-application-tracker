import { computeApplicationStats, startOfUtcWeek, type StatsRow } from "./application-stats";

// A Friday, so the current week starts Monday 2026-11-02.
const now = new Date("2026-11-06T12:00:00.000Z");
const opts = { now, staleDays: 7 };

function row(overrides: Partial<StatsRow> = {}): StatsRow {
  return {
    status: "APPLIED",
    appliedAt: null,
    createdAt: new Date("2026-11-05T00:00:00.000Z"),
    updatedAt: new Date("2026-11-05T00:00:00.000Z"),
    ...overrides,
  };
}

describe("startOfUtcWeek", () => {
  it("returns the Monday at UTC midnight", () => {
    expect(startOfUtcWeek(new Date("2026-11-06T12:00:00.000Z")).toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("treats Sunday as the last day of the week, not the first", () => {
    expect(startOfUtcWeek(new Date("2026-11-08T23:59:59.999Z")).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(startOfUtcWeek(new Date("2026-11-09T00:00:00.000Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z");
  });
});

describe("computeApplicationStats", () => {
  it("returns zeros, 12 empty weeks and null rates for no applications", () => {
    const stats = computeApplicationStats([], opts);

    expect(stats.total).toBe(0);
    expect(stats.byStatus).toEqual({ APPLIED: 0, INTERVIEWING: 0, OFFER: 0, REJECTED: 0, WITHDRAWN: 0 });
    expect(stats.weekly).toHaveLength(12);
    expect(stats.weekly[0]!.weekStart).toBe("2026-08-17");
    expect(stats.weekly[11]!.weekStart).toBe("2026-11-02");
    expect(stats.weekly.every((w) => w.count === 0)).toBe(true);
    expect(stats.conversion).toEqual({ interviewRate: null, offerRate: null, offerFromInterviewRate: null });
    expect(stats.stale).toEqual({ count: 0, thresholdDays: 7 });
  });

  it("counts by status", () => {
    const stats = computeApplicationStats(
      [row(), row(), row({ status: "INTERVIEWING" }), row({ status: "REJECTED" })],
      opts,
    );

    expect(stats.total).toBe(4);
    expect(stats.byStatus).toEqual({ APPLIED: 2, INTERVIEWING: 1, OFFER: 0, REJECTED: 1, WITHDRAWN: 0 });
  });

  it("buckets by appliedAt, falling back to createdAt", () => {
    const stats = computeApplicationStats(
      [
        row({ appliedAt: new Date("2026-10-26T00:00:00.000Z"), createdAt: new Date("2026-11-05T00:00:00.000Z") }),
        row({ appliedAt: null, createdAt: new Date("2026-11-02T00:00:00.000Z") }),
        // Sunday night belongs to the previous week.
        row({ appliedAt: new Date("2026-11-01T23:00:00.000Z") }),
      ],
      opts,
    );

    expect(stats.weekly.at(-2)).toEqual({ weekStart: "2026-10-26", count: 2 });
    expect(stats.weekly.at(-1)).toEqual({ weekStart: "2026-11-02", count: 1 });
  });

  it("leaves applications outside the 12-week window out of the weekly chart but not the totals", () => {
    const stats = computeApplicationStats([row({ appliedAt: new Date("2026-08-16T00:00:00.000Z") })], opts);

    expect(stats.weekly.every((w) => w.count === 0)).toBe(true);
    expect(stats.total).toBe(1);
  });

  it("computes conversion rates from current statuses", () => {
    const stats = computeApplicationStats(
      [row(), row(), row({ status: "INTERVIEWING" }), row({ status: "OFFER" })],
      opts,
    );

    expect(stats.conversion).toEqual({ interviewRate: 0.5, offerRate: 0.25, offerFromInterviewRate: 0.5 });
  });

  it("returns a null offer-from-interview rate when nothing reached an interview", () => {
    const stats = computeApplicationStats([row(), row({ status: "REJECTED" })], opts);

    expect(stats.conversion).toEqual({ interviewRate: 0, offerRate: 0, offerFromInterviewRate: null });
  });

  it("counts only applied/interviewing applications untouched for the stale threshold or longer", () => {
    const exactlySevenDays = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const justUnder = new Date(exactlySevenDays.getTime() + 1);

    const stats = computeApplicationStats(
      [
        row({ updatedAt: exactlySevenDays }),
        row({ status: "INTERVIEWING", updatedAt: new Date("2026-10-01T00:00:00.000Z") }),
        row({ updatedAt: justUnder }),
        row({ status: "OFFER", updatedAt: new Date("2026-10-01T00:00:00.000Z") }),
        row({ status: "REJECTED", updatedAt: new Date("2026-10-01T00:00:00.000Z") }),
      ],
      opts,
    );

    expect(stats.stale.count).toBe(2);
  });
});
