import type { UpcomingInterviewRow } from "./interviews.repository";
import { KIND_LABELS } from "./interview-kind-labels";

/** No duration is stored, so every event is an hour long; users adjust it in their calendar. */
const EVENT_DURATION_MS = 60 * 60 * 1000;

/** Stable per interview, so re-importing a downloaded file updates the event instead of duplicating it. */
const UID_DOMAIN = "job-application-tracker";

/** RFC 5545 UTC date-time: 20261120T093000Z. */
function icsDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are escaped in TEXT values. */
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + space.
 * Counted in UTF-8 bytes, never splitting a character.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with a space, which counts towards their 75.
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function eventLines(interview: UpcomingInterviewRow, origin: string, now: Date): string[] {
  const { application } = interview;
  const link = `${origin}/applications/${application.id}`;
  const description = interview.notes ? `${interview.notes}\n\n${link}` : link;
  return [
    "BEGIN:VEVENT",
    `UID:interview-${interview.id}@${UID_DOMAIN}`,
    `DTSTAMP:${icsDateTime(now)}`,
    `LAST-MODIFIED:${icsDateTime(interview.updatedAt)}`,
    `DTSTART:${icsDateTime(interview.scheduledAt)}`,
    `DTEND:${icsDateTime(new Date(interview.scheduledAt.getTime() + EVENT_DURATION_MS))}`,
    `SUMMARY:${escapeText(`${KIND_LABELS[interview.kind]}: ${application.position} at ${application.company.name}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${link}`,
    "END:VEVENT",
  ];
}

/** An iCalendar file (CRLF line endings) with one event per interview. */
export function interviewsToIcs(interviews: readonly UpcomingInterviewRow[], webOrigin: string, now: Date): string {
  const origin = webOrigin.replace(/\/$/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Job Application Tracker//Interviews//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...interviews.flatMap((interview) => eventLines(interview, origin, now)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
