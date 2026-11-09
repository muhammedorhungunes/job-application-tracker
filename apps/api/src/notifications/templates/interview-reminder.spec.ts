import { buildInterviewReminder, formatInterviewTime } from "./interview-reminder";

const base = {
  userName: "Orhun",
  kind: "TECHNICAL" as const,
  companyName: "Acme",
  position: "Backend Engineer",
  scheduledAt: new Date("2026-11-12T11:00:00.000Z"),
  notes: null,
  applicationUrl: "http://localhost:3000/applications/app-1",
  timeZone: "Europe/Istanbul",
};

describe("formatInterviewTime", () => {
  it("formats in the given zone, 24-hour, naming the zone", () => {
    expect(formatInterviewTime(new Date("2026-11-12T11:00:00.000Z"), "Europe/Istanbul")).toBe(
      "Thu, Nov 12 at 14:00 (Europe/Istanbul)",
    );
    // Crosses midnight in the target zone.
    expect(formatInterviewTime(new Date("2026-11-12T22:30:00.000Z"), "Europe/Istanbul")).toBe(
      "Fri, Nov 13 at 01:30 (Europe/Istanbul)",
    );
  });
});

describe("buildInterviewReminder", () => {
  it("builds subject and both bodies with the time in the configured zone", () => {
    const { subject, text, html } = buildInterviewReminder(base);

    expect(subject).toBe("Reminder: Technical interview with Acme on Thu, Nov 12 at 14:00 (Europe/Istanbul)");
    expect(text).toContain("You have a technical interview with Acme for Backend Engineer on Thu, Nov 12 at 14:00");
    expect(text).toContain(base.applicationUrl);
    expect(text).not.toContain("Your notes");
    expect(html).toContain(`<a href="${base.applicationUrl}">`);
  });

  it("includes notes when present", () => {
    const { text, html } = buildInterviewReminder({ ...base, notes: "Bring laptop" });

    expect(text).toContain("Your notes:\nBring laptop");
    expect(html).toContain("Bring laptop");
  });

  it("escapes user-provided values in the HTML body", () => {
    const { html } = buildInterviewReminder({
      ...base,
      companyName: "<script>Acme</script>",
      notes: `"quoted" & <b>`,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;Acme&lt;/script&gt;");
    expect(html).toContain("&quot;quoted&quot; &amp; &lt;b&gt;");
  });
});
