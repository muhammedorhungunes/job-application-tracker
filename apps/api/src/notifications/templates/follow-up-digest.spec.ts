import { buildFollowUpDigest, type DigestFollowUp } from "./follow-up-digest";

describe("buildFollowUpDigest", () => {
  const item = (overrides: Partial<DigestFollowUp> = {}): DigestFollowUp => ({
    dueDate: "2026-12-03",
    note: "E-mail Jane again",
    contactName: "Jane Doe",
    applicationId: "app-1",
    companyName: "Acme",
    position: "Backend Engineer",
    ...overrides,
  });

  it("names the company in the subject for a single follow-up", () => {
    const { subject } = buildFollowUpDigest({
      userName: "Orhun",
      today: "2026-12-03",
      followUps: [item()],
      webOrigin: "http://x",
    });
    expect(subject).toBe("Follow-up due: Acme");
  });

  it("lists each follow-up with context, a link, and the date when overdue", () => {
    const { subject, text, html } = buildFollowUpDigest({
      userName: "Orhun",
      today: "2026-12-03",
      followUps: [item(), item({ dueDate: "2026-12-01", contactName: null, companyName: "Globex", applicationId: "a b" })],
      webOrigin: "http://localhost:3000/",
    });

    expect(subject).toBe("2 follow-ups are due");
    expect(text).toContain("- E-mail Jane again (Acme — Backend Engineer, with Jane Doe)");
    expect(text).toContain("http://localhost:3000/applications/app-1");
    expect(text).toContain("(Globex — Backend Engineer, due Dec 1, 2026)");
    expect(html).toContain('<a href="http://localhost:3000/applications/a%20b">');
  });

  it("escapes user text in the HTML", () => {
    const { html } = buildFollowUpDigest({
      userName: "<b>Orhun</b>",
      today: "2026-12-03",
      followUps: [item({ note: "<script>x</script>" })],
      webOrigin: "http://x",
    });
    expect(html).toContain("&lt;b&gt;Orhun&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
