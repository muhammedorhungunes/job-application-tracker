import type { Application, ApplicationStatus, SalaryPeriod, WorkMode } from "@job-tracker/types";

/** "INTERVIEWING" -> "Interviewing" */
export function formatStatus(status: ApplicationStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/** Dates are stored as UTC midnight, so they're shown in UTC to avoid an off-by-one day. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

const WORK_MODE_LABELS: Record<WorkMode, string> = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" };

export function formatWorkMode(mode: WorkMode): string {
  return WORK_MODE_LABELS[mode];
}

export const SALARY_PERIOD_LABELS: Record<SalaryPeriod, string> = { YEAR: "year", MONTH: "month", HOUR: "hour" };

function formatAmount(amount: string, currency: string): string {
  const value = Number(amount);
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    // A well-formed but unknown code (e.g. "ABC") makes Intl throw.
    return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
  }
}

type SalaryFields = Pick<Application, "salaryMin" | "salaryMax" | "salaryCurrency" | "salaryPeriod">;

/** "€60,000–€75,000 / year", or null when there's no salary. */
export function formatSalary({ salaryMin, salaryMax, salaryCurrency, salaryPeriod }: SalaryFields): string | null {
  if (!(salaryMin || salaryMax) || !salaryCurrency || !salaryPeriod) return null;
  const min = salaryMin && formatAmount(salaryMin, salaryCurrency);
  const max = salaryMax && formatAmount(salaryMax, salaryCurrency);
  const range =
    min && max ? (min === max ? min : `${min}–${max}`) : min ? `from ${min}` : `up to ${max}`;
  return `${range} / ${SALARY_PERIOD_LABELS[salaryPeriod]}`;
}

/** "Berlin · Hybrid", skipping whatever isn't set; null when neither is. */
export function formatLocation({ location, workMode }: Pick<Application, "location" | "workMode">): string | null {
  const parts = [location, workMode && formatWorkMode(workMode)].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}
