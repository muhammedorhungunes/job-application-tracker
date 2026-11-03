import {
  CreateApplicationInputSchema,
  UpdateApplicationInputSchema,
  type Application,
} from "@job-tracker/types";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** `<input type="date">` yields "YYYY-MM-DD"; the API wants an ISO datetime, stored as UTC midnight. */
function dateToIso(value: string): string {
  return DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value;
}

/** The "YYYY-MM-DD" value a date input shows for a stored ISO datetime. */
export function isoToDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** The tech stack input is a comma-separated list; blanks and case-insensitive duplicates are dropped. */
export function parseTechStack(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value.split(",")) {
    const name = item.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      result.push(name);
    }
  }
  return result;
}

export function formatTechStack(techStack: string[]): string {
  return techStack.join(", ");
}

/**
 * Empty inputs become "not provided" — the shared schema's `min(1)` would
 * otherwise reject an untouched optional field as an empty string.
 */
export function parseCreateApplicationForm(formData: FormData) {
  const optional = (key: string): string | undefined => field(formData, key) || undefined;
  const appliedAt = optional("appliedAt");
  const techStack = parseTechStack(field(formData, "techStack"));

  return CreateApplicationInputSchema.safeParse({
    position: field(formData, "position"),
    companyName: field(formData, "companyName"),
    status: optional("status"),
    source: optional("source"),
    url: optional("url"),
    notes: optional("notes"),
    appliedAt: appliedAt ? dateToIso(appliedAt) : undefined,
    techStack: techStack.length > 0 ? techStack : undefined,
  });
}

/**
 * Builds a PATCH body with only the fields that differ from `current`.
 * Clearing an optional input sends `null`, which the API treats as "clear
 * this value" (see UpdateApplicationInputSchema). Nothing changed fails the
 * schema's "at least one field" rule.
 */
export function parseUpdateApplicationForm(formData: FormData, current: Application) {
  const changes: Record<string, string | string[] | null> = {};

  const position = field(formData, "position");
  if (position !== current.position) changes.position = position;

  const companyName = field(formData, "companyName");
  if (companyName !== current.company.name) changes.companyName = companyName;

  const status = field(formData, "status");
  if (status !== current.status) changes.status = status;

  for (const key of ["source", "url", "notes"] as const) {
    const value = field(formData, key) || null;
    if (value !== current[key]) changes[key] = value;
  }

  // Compared by calendar date so an untouched field doesn't overwrite a
  // stored time-of-day with midnight.
  const appliedAt = field(formData, "appliedAt");
  if (appliedAt !== isoToDateInput(current.appliedAt)) {
    changes.appliedAt = appliedAt ? dateToIso(appliedAt) : null;
  }

  const techStack = parseTechStack(field(formData, "techStack"));
  if (formatTechStack(techStack) !== formatTechStack(current.techStack)) changes.techStack = techStack;

  return UpdateApplicationInputSchema.safeParse(changes);
}
