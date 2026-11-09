import {
  CreateInterviewInputSchema,
  CreateNoteInputSchema,
  UpdateInterviewInputSchema,
  type InterviewKind,
} from "@job-tracker/types";

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * `<input type="datetime-local">` yields "YYYY-MM-DDTHH:mm" with no zone.
 * Converted in the browser, so it's read as the user's local time; returns
 * "" for anything else so zod reports it as invalid.
 */
export function localInputToIso(value: string): string {
  if (!LOCAL_DATETIME.test(value)) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** The "YYYY-MM-DDTHH:mm" a datetime-local input shows for an ISO time, in the current (browser) zone. */
export function isoToLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const KIND_LABELS: Record<InterviewKind, string> = {
  PHONE: "Phone",
  TECHNICAL: "Technical",
  ONSITE: "Onsite",
  OTHER: "Other",
};

export function formatInterviewKind(kind: InterviewKind): string {
  return KIND_LABELS[kind];
}

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** `scheduledAt` is the ISO value the client form computed from its local input. */
export function parseCreateInterviewForm(formData: FormData) {
  const notes = field(formData, "notes");
  return CreateInterviewInputSchema.safeParse({
    kind: field(formData, "kind"),
    scheduledAt: field(formData, "scheduledAt"),
    ...(notes ? { notes } : {}),
  });
}

/**
 * The edit form always sends every field; the API only logs a reschedule when
 * the time actually changed, so no diffing is needed here. Empty notes clear them.
 */
export function parseUpdateInterviewForm(formData: FormData) {
  return UpdateInterviewInputSchema.safeParse({
    kind: field(formData, "kind"),
    scheduledAt: field(formData, "scheduledAt"),
    notes: field(formData, "notes") || null,
  });
}

export function parseNoteForm(formData: FormData) {
  return CreateNoteInputSchema.safeParse({ text: field(formData, "text") });
}
