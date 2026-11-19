import { interviewsToIcs } from "./ics";
import type { UpcomingInterviewRow } from "./interviews.repository";

describe("interviewsToIcs", () => {
  const now = new Date("2026-11-20T08:00:00.000Z");
  const interview: UpcomingInterviewRow = {
    id: "int-1",
    kind: "TECHNICAL",
    scheduledAt: new Date("2026-11-24T09:30:00.000Z"),
    notes: null,
    createdAt: new Date("2026-11-19T10:00:00.000Z"),
    updatedAt: new Date("2026-11-19T10:15:00.000Z"),
    application: { id: "app-1", position: "Backend Engineer", status: "INTERVIEWING", company: { id: "co-1", name: "Acme" } },
  };

  /** Undoes line folding so assertions can look at whole properties. */
  const unfold = (ics: string) => ics.replace(/\r\n /g, "");

  it("builds a calendar with a one-hour UTC event per interview, using CRLF", () => {
    const ics = interviewsToIcs([interview], "https://tracker.example/", now);
    const lines = ics.split("\r\n");

    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    expect(lines).toEqual(
      expect.arrayContaining([
        "VERSION:2.0",
        "UID:interview-int-1@job-application-tracker",
        "DTSTAMP:20261120T080000Z",
        "LAST-MODIFIED:20261119T101500Z",
        "DTSTART:20261124T093000Z",
        "DTEND:20261124T103000Z",
        "SUMMARY:Technical interview: Backend Engineer at Acme",
        "URL:https://tracker.example/applications/app-1",
      ]),
    );
  });

  it("escapes notes and puts the link after them", () => {
    const ics = interviewsToIcs([{ ...interview, notes: "Bring CV; ask about A, B\\C\nRoom 2" }], "https://tracker.example", now);

    expect(unfold(ics)).toContain(
      "DESCRIPTION:Bring CV\\; ask about A\\, B\\\\C\\nRoom 2\\n\\nhttps://tracker.example/applications/app-1",
    );
  });

  it("escapes commas in the summary", () => {
    const ics = interviewsToIcs(
      [{ ...interview, application: { ...interview.application, company: { id: "co-1", name: "Acme, Inc." } } }],
      "https://tracker.example",
      now,
    );

    expect(ics).toContain("SUMMARY:Technical interview: Backend Engineer at Acme\\, Inc.");
  });

  it("folds lines at 75 bytes without splitting multi-byte characters", () => {
    const notes = "Gesprächsnotizen über Größe und Übergänge ".repeat(5);
    const ics = interviewsToIcs([{ ...interview, notes }], "https://tracker.example", now);
    const encoder = new TextEncoder();

    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(unfold(ics)).toContain(`DESCRIPTION:${notes.trim()}`);
  });

  it("returns an empty calendar when there are no interviews", () => {
    const ics = interviewsToIcs([], "https://tracker.example", now);

    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});
