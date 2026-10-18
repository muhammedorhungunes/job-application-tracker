import type { ApplicationStatus } from "@job-tracker/types";

/** "INTERVIEWING" -> "Interviewing" */
export function formatStatus(status: ApplicationStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/** Dates are stored as UTC midnight, so they're shown in UTC to avoid an off-by-one day. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}
