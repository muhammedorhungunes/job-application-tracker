import type { ApplicationStatus } from "@prisma/client";
import { ApplicationStatusValues, type ApplicationStats } from "@job-tracker/types";
import { REMINDABLE_STATUSES } from "../notifications/notifications.constants";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface StatsRow {
  status: ApplicationStatus;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StatsOptions {
  now: Date;
  staleDays: number;
  weeks?: number;
}

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfUtcWeek(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY_MS);
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function computeApplicationStats(rows: StatsRow[], { now, staleDays, weeks = 12 }: StatsOptions): ApplicationStats {
  const byStatus = Object.fromEntries(ApplicationStatusValues.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  for (const row of rows) {
    byStatus[row.status] += 1;
  }

  const currentWeek = startOfUtcWeek(now).getTime();
  const firstWeek = currentWeek - (weeks - 1) * WEEK_MS;
  const weekly = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(firstWeek + i * WEEK_MS).toISOString().slice(0, 10),
    count: 0,
  }));
  for (const row of rows) {
    // appliedAt is optional on the form; fall back to when the row was added.
    const index = Math.floor((startOfUtcWeek(row.appliedAt ?? row.createdAt).getTime() - firstWeek) / WEEK_MS);
    const bucket = weekly[index];
    if (bucket) {
      bucket.count += 1;
    }
  }

  // Same "stale" rule as the reminder digest, minus its once-per-silence
  // bookkeeping: this counts everything currently waiting too long.
  const staleBefore = now.getTime() - staleDays * DAY_MS;
  const remindable: readonly ApplicationStatus[] = REMINDABLE_STATUSES;
  const staleCount = rows.filter((r) => remindable.includes(r.status) && r.updatedAt.getTime() <= staleBefore).length;

  const reachedInterview = byStatus.INTERVIEWING + byStatus.OFFER;
  return {
    total: rows.length,
    byStatus,
    weekly,
    conversion: {
      interviewRate: rate(reachedInterview, rows.length),
      offerRate: rate(byStatus.OFFER, rows.length),
      offerFromInterviewRate: rate(byStatus.OFFER, reachedInterview),
    },
    stale: { count: staleCount, thresholdDays: staleDays },
  };
}
