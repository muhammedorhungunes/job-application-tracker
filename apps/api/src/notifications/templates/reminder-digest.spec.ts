import { buildReminderDigest, type DigestApplication } from "./reminder-digest";

describe("buildReminderDigest", () => {
  const now = new Date("2026-11-05T06:00:00.000Z");
  const app = (overrides: Partial<DigestApplication> = {}): DigestApplication => ({
    id: "app-1",
    companyName: "Acme",
    position: "Backend Engineer",
    status: "APPLIED",
    updatedAt: new Date("2026-10-27T06:00:00.000Z"),
    ...overrides,
  });

  it("names the company in the subject for a single application", () => {
    const { subject } = buildReminderDigest({ userName: "Orhun", applications: [app()], webOrigin: "http://x", now });
    expect(subject).toBe("No update on your Acme application");
  });

  it("lists every application with its age and a link", () => {
    const { subject, text, html } = buildReminderDigest({
      userName: "Orhun",
      applications: [app(), app({ id: "app-2", companyName: "Globex", status: "INTERVIEWING" })],
      webOrigin: "http://localhost:3000/",
      now,
    });

    expect(subject).toBe("2 applications have had no update for a while");
    expect(text).toContain("- Acme — Backend Engineer (Applied), no update for 9 days");
    expect(text).toContain("http://localhost:3000/applications/app-1");
    expect(text).toContain("Globex — Backend Engineer (Interviewing)");
    expect(html).toContain('<a href="http://localhost:3000/applications/app-2">');
  });

  it("escapes user-provided text in the HTML", () => {
    const { html } = buildReminderDigest({
      userName: "<b>me</b>",
      applications: [app({ companyName: `A&B "<script>"` })],
      webOrigin: "http://x",
      now,
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>me</b>");
    expect(html).toContain("A&amp;B &quot;&lt;script&gt;&quot;");
  });
});
