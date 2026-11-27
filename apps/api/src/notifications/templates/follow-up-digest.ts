import { escapeHtml } from "./html";

export interface DigestFollowUp {
  /** YYYY-MM-DD */
  dueDate: string;
  note: string;
  contactName: string | null;
  applicationId: string;
  companyName: string;
  position: string;
}

export interface FollowUpDigestInput {
  userName: string;
  /** The user's local YYYY-MM-DD the e-mail is for; earlier due dates are shown as overdue. */
  today: string;
  followUps: DigestFollowUp[];
  webOrigin: string;
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00.000Z`),
  );
}

export function buildFollowUpDigest(input: FollowUpDigestInput): { subject: string; html: string; text: string } {
  const { userName, today, followUps, webOrigin } = input;
  const origin = webOrigin.replace(/\/$/, "");
  const count = followUps.length;
  const subject =
    count === 1 ? `Follow-up due: ${followUps[0]!.companyName}` : `${count} follow-ups are due`;

  const rows = followUps.map((followUp) => ({
    url: `${origin}/applications/${encodeURIComponent(followUp.applicationId)}`,
    note: followUp.note,
    context: [
      `${followUp.companyName} — ${followUp.position}`,
      followUp.contactName ? `with ${followUp.contactName}` : null,
      followUp.dueDate < today ? `due ${formatDay(followUp.dueDate)}` : null,
    ]
      .filter((part): part is string => part !== null)
      .join(", "),
  }));

  const text = [
    `Hi ${userName},`,
    "",
    "You planned to follow up on these:",
    "",
    ...rows.map((r) => `- ${r.note} (${r.context})\n  ${r.url}`),
    "",
    "Mark them done on the application page once you've followed up.",
    "",
    "— Job Tracker",
  ].join("\n");

  const html = [
    `<p>Hi ${escapeHtml(userName)},</p>`,
    "<p>You planned to follow up on these:</p>",
    "<ul>",
    ...rows.map((r) => `<li>${escapeHtml(r.note)} (<a href="${escapeHtml(r.url)}">${escapeHtml(r.context)}</a>)</li>`),
    "</ul>",
    "<p>Mark them done on the application page once you've followed up.</p>",
    "<p>— Job Tracker</p>",
  ].join("\n");

  return { subject, html, text };
}
