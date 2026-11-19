import { calendarDownload } from "@/lib/calendar-download";

/** One interview as an .ics file. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; interviewId: string }> },
): Promise<Response> {
  const { id, interviewId } = await params;
  const path = `/applications/${encodeURIComponent(id)}/interviews/${encodeURIComponent(interviewId)}/calendar`;
  return calendarDownload(path, "interview.ics");
}
