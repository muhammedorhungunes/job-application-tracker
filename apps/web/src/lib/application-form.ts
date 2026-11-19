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

/** The API returns "65000.00"; the input shows "65000" unless there are cents. */
export function amountToInput(amount: string | null): string {
  return amount ? amount.replace(/\.00$/, "") : "";
}

/** "65000" and "65000.00" are the same amount; anything malformed counts as different so the schema reports it. */
function sameAmount(input: string, stored: string | null): boolean {
  if (!input || !stored) return !input && !stored;
  return /^\d+(\.\d+)?$/.test(input) && Number(input) === Number(stored);
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
    location: optional("location"),
    workMode: optional("workMode"),
    salaryMin: optional("salaryMin"),
    salaryMax: optional("salaryMax"),
    salaryCurrency: optional("salaryCurrency"),
    salaryPeriod: optional("salaryPeriod"),
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

  for (const key of ["source", "url", "notes", "location", "workMode"] as const) {
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

  // The salary fields go together: if anything about the salary changed, all
  // four are sent so the schema can check them as a whole (min <= max, a
  // currency for an amount). Currency / period alone don't matter while
  // there's no amount, since the form always submits their defaults.
  const salary = {
    salaryMin: field(formData, "salaryMin") || null,
    salaryMax: field(formData, "salaryMax") || null,
    salaryCurrency: field(formData, "salaryCurrency").toUpperCase() || null,
    salaryPeriod: field(formData, "salaryPeriod") || null,
  };
  const amountsChanged =
    !sameAmount(salary.salaryMin ?? "", current.salaryMin) || !sameAmount(salary.salaryMax ?? "", current.salaryMax);
  const hasAmount = Boolean(salary.salaryMin || salary.salaryMax);
  const unitChanged =
    hasAmount && (salary.salaryCurrency !== current.salaryCurrency || salary.salaryPeriod !== current.salaryPeriod);
  if (amountsChanged || unitChanged) Object.assign(changes, salary);

  return UpdateApplicationInputSchema.safeParse(changes);
}
