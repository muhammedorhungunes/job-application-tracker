import type { ApplicationStatus } from "@prisma/client";
import { escapeHtml } from "./html";

export interface DigestApplication {
  id: string;
  companyName: string;
  position: string;
  status: ApplicationStatus;
  updatedAt: Date;
}

export interface ReminderDigestInput {
  userName: string;
  applications: DigestApplication[];
  webOrigin: string;
  now: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

export function buildReminderDigest(input: ReminderDigestInput): { subject: string; html: string; text: string } {
  const { userName, applications, webOrigin, now } = input;
  const origin = webOrigin.replace(/\/$/, "");
  const count = applications.length;
  const subject =
    count === 1
      ? `No update on your ${applications[0]!.companyName} application`
      : `${count} applications have had no update for a while`;

  const rows = applications.map((app) => ({
    url: `${origin}/applications/${encodeURIComponent(app.id)}`,
    line: `${app.companyName} — ${app.position} (${STATUS_LABELS[app.status]})`,
    age: `no update for ${daysSince(app.updatedAt, now)} days`,
  }));

  const text = [
    `Hi ${userName},`,
    "",
    "These applications haven't been updated in a while. Time to follow up or update their status:",
    "",
    ...rows.map((r) => `- ${r.line}, ${r.age}\n  ${r.url}`),
    "",
    "— Job Tracker",
  ].join("\n");

  const html = [
    `<p>Hi ${escapeHtml(userName)},</p>`,
    "<p>These applications haven't been updated in a while. Time to follow up or update their status:</p>",
    "<ul>",
    ...rows.map((r) => `<li><a href="${escapeHtml(r.url)}">${escapeHtml(r.line)}</a>, ${escapeHtml(r.age)}</li>`),
    "</ul>",
    "<p>— Job Tracker</p>",
  ].join("\n");

  return { subject, html, text };
}
