import type { InterviewKind } from "@prisma/client";
import { escapeHtml } from "./html";

export interface InterviewReminderInput {
  userName: string;
  kind: InterviewKind;
  companyName: string;
  position: string;
  scheduledAt: Date;
  notes: string | null;
  applicationUrl: string;
  /** IANA zone the time is shown in (REMINDER_TZ); the server doesn't know the user's own. */
  timeZone: string;
}

const KIND_LABELS: Record<InterviewKind, string> = {
  PHONE: "Phone interview",
  TECHNICAL: "Technical interview",
  ONSITE: "Onsite interview",
  OTHER: "Interview",
};

/** "Wed, Nov 12 at 14:00 (Europe/Istanbul)" */
export function formatInterviewTime(date: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(
    date,
  );
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} at ${time} (${timeZone})`;
}

export function buildInterviewReminder(input: InterviewReminderInput): { subject: string; html: string; text: string } {
  const what = `${KIND_LABELS[input.kind]} with ${input.companyName}`;
  const when = formatInterviewTime(input.scheduledAt, input.timeZone);
  const subject = `Reminder: ${what} on ${when}`;

  const text = [
    `Hi ${input.userName},`,
    "",
    `You have a ${what.charAt(0).toLowerCase()}${what.slice(1)} for ${input.position} on ${when}.`,
    ...(input.notes ? ["", "Your notes:", input.notes] : []),
    "",
    input.applicationUrl,
    "",
    "Good luck!",
    "— Job Tracker",
  ].join("\n");

  const html = [
    `<p>Hi ${escapeHtml(input.userName)},</p>`,
    `<p>You have a ${escapeHtml(what.charAt(0).toLowerCase() + what.slice(1))} for ${escapeHtml(input.position)} on <strong>${escapeHtml(when)}</strong>.</p>`,
    ...(input.notes
      ? [`<p>Your notes:</p>`, `<p style="white-space: pre-wrap">${escapeHtml(input.notes)}</p>`]
      : []),
    `<p><a href="${escapeHtml(input.applicationUrl)}">Open the application</a></p>`,
    "<p>Good luck!<br>— Job Tracker</p>",
  ].join("\n");

  return { subject, html, text };
}
