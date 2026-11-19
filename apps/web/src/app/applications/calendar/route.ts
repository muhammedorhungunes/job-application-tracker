import { calendarDownload } from "@/lib/calendar-download";

/** Every upcoming interview as one .ics file. */
export async function GET(): Promise<Response> {
  return calendarDownload("/interviews/calendar", "interviews.ics");
}
