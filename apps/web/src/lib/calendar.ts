/** Links to the .ics route handlers. Kept apart from calendar-download.ts, which is server-only. */
export const ALL_INTERVIEWS_CALENDAR_HREF = "/applications/calendar";

export function interviewCalendarHref(applicationId: string, interviewId: string): string {
  return `/applications/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}/calendar`;
}
