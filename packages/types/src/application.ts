import { z } from "zod";

/**
 * Mirrors prisma/schema.prisma's `ApplicationStatus` enum by hand — Prisma
 * enums can't be imported into plain TypeScript. Keep both lists in sync
 * whenever one changes.
 */
export const ApplicationStatusValues = [
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;
export const ApplicationStatusSchema = z.enum(ApplicationStatusValues);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

/** Statuses after which an application's interviews no longer matter (no reminders, not listed as upcoming). */
export const ClosedApplicationStatusValues = ["REJECTED", "WITHDRAWN"] as const satisfies readonly ApplicationStatus[];

/** Mirrors prisma/schema.prisma's `WorkMode` enum by hand. */
export const WorkModeValues = ["ONSITE", "HYBRID", "REMOTE"] as const;
export const WorkModeSchema = z.enum(WorkModeValues);
export type WorkMode = z.infer<typeof WorkModeSchema>;

/** Mirrors prisma/schema.prisma's `SalaryPeriod` enum by hand. */
export const SalaryPeriodValues = ["YEAR", "MONTH", "HOUR"] as const;
export const SalaryPeriodSchema = z.enum(SalaryPeriodValues);
export type SalaryPeriod = z.infer<typeof SalaryPeriodSchema>;

/**
 * A money amount as a decimal string ("65000" or "65000.50"). It crosses
 * HTTP as a string so it's never rounded through a JS float; the column is
 * Decimal(12, 2), hence at most 10 integer digits.
 */
export const MoneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 65000 or 65000.50");

/** ISO 4217 code; lower case input is accepted and upper-cased. */
export const CurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code like EUR");

export type SalaryFields = {
  salaryMin?: string | null;
  salaryMax?: string | null;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriod | null;
};

export type SalaryIssue = { path: keyof SalaryFields; message: string };

/**
 * Cross-field salary rules, shared by the create schema and the service's
 * PATCH check (which runs them on the stored values merged with the patch).
 * A currency or period without any amount is not an error: the form always
 * submits its defaults, and the service then stores no salary at all.
 */
export function salaryIssues(fields: SalaryFields): SalaryIssue[] {
  const { salaryMin, salaryMax, salaryCurrency, salaryPeriod } = fields;
  const issues: SalaryIssue[] = [];
  if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
    issues.push({ path: "salaryMax", message: "Maximum must not be below the minimum" });
  }
  if (salaryMin || salaryMax) {
    if (!salaryCurrency) issues.push({ path: "salaryCurrency", message: "Choose a currency for the salary" });
    if (!salaryPeriod) issues.push({ path: "salaryPeriod", message: "Choose a period for the salary" });
  }
  return issues;
}

function addSalaryIssues(fields: SalaryFields, ctx: z.RefinementCtx): void {
  for (const issue of salaryIssues(fields)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.path], message: issue.message });
  }
}

/** Minimal company info embedded in an application response — not the full Company record. */
export const CompanySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type CompanySummary = z.infer<typeof CompanySummarySchema>;

/** Shape of an application as returned by the API. Dates are ISO strings over HTTP. */
export const ApplicationSchema = z.object({
  id: z.string(),
  position: z.string(),
  status: ApplicationStatusSchema,
  source: z.string().nullable(),
  url: z.string().nullable(),
  appliedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  techStack: z.array(z.string()),
  location: z.string().nullable(),
  workMode: WorkModeSchema.nullable(),
  /** Decimal strings with two places, e.g. "65000.00". */
  salaryMin: z.string().nullable(),
  salaryMax: z.string().nullable(),
  salaryCurrency: z.string().nullable(),
  salaryPeriod: SalaryPeriodSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  company: CompanySummarySchema,
});
export type Application = z.infer<typeof ApplicationSchema>;

/** Response item of GET /applications/archived, newest archive first. */
export const ArchivedApplicationSchema = ApplicationSchema.extend({
  archivedAt: z.string().datetime(),
});
export type ArchivedApplication = z.infer<typeof ArchivedApplicationSchema>;

export const TechStackSchema = z.array(z.string().trim().min(1).max(50)).max(30);

/**
 * Input for creating an application. There's no company-picker endpoint yet,
 * so the client sends a plain company name and the backend finds-or-creates
 * the Company row by it (see ApplicationsService.getOrCreateCompany).
 */
export const CreateApplicationInputSchema = z
  .object({
    position: z.string().trim().min(1).max(200),
    companyName: z.string().trim().min(1).max(200),
    status: ApplicationStatusSchema.optional(),
    source: z.string().trim().min(1).max(200).optional(),
    url: z.string().trim().url().optional(),
    appliedAt: z.string().datetime().optional(),
    notes: z.string().trim().min(1).max(5000).optional(),
    techStack: TechStackSchema.optional(),
    location: z.string().trim().min(1).max(200).optional(),
    workMode: WorkModeSchema.optional(),
    salaryMin: MoneySchema.optional(),
    salaryMax: MoneySchema.optional(),
    salaryCurrency: CurrencySchema.optional(),
    salaryPeriod: SalaryPeriodSchema.optional(),
  })
  .superRefine(addSalaryIssues);
export type CreateApplicationInput = z.infer<typeof CreateApplicationInputSchema>;

/**
 * Input for a partial update (PATCH). Every field is optional so the client
 * only sends what changed. Every field except `position`, `companyName`,
 * `status` and `techStack` is also `.nullable()` (unlike in create) so a client can explicitly clear a
 * previously-set value by sending `null` — omitting a key leaves it
 * untouched, which zod represents by the key being absent after parsing (see
 * ApplicationsService.update, which checks `"field" in input`).
 */
export const UpdateApplicationInputSchema = z
  .object({
    position: z.string().trim().min(1).max(200).optional(),
    companyName: z.string().trim().min(1).max(200).optional(),
    status: ApplicationStatusSchema.optional(),
    source: z.string().trim().min(1).max(200).nullable().optional(),
    url: z.string().trim().url().nullable().optional(),
    appliedAt: z.string().datetime().nullable().optional(),
    notes: z.string().trim().min(1).max(5000).nullable().optional(),
    // Not nullable: an empty array already means "no tech stack".
    techStack: TechStackSchema.optional(),
    location: z.string().trim().min(1).max(200).nullable().optional(),
    workMode: WorkModeSchema.nullable().optional(),
    salaryMin: MoneySchema.nullable().optional(),
    salaryMax: MoneySchema.nullable().optional(),
    salaryCurrency: CurrencySchema.nullable().optional(),
    salaryPeriod: SalaryPeriodSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one field to update" })
  .superRefine((data, ctx) => {
    // A partial salary patch can only be checked against the stored values,
    // which the service does; here only a complete one is checked, so the
    // web form (which always sends all four together) gets field errors.
    const complete = (["salaryMin", "salaryMax", "salaryCurrency", "salaryPeriod"] as const).every((key) => key in data);
    if (complete) addSalaryIssues(data, ctx);
  });
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationInputSchema>;

/** A GET form submits untouched fields as "", which should mean "no filter". */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

/** `YYYY-MM-DD` that is a real calendar day (rejects 2026-02-31). */
export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value), { message: "Invalid date" });

/**
 * Query of GET /applications, also used to parse the board page's URL
 * search params. Filters combine with AND; omitting all of them lists every
 * application. `from`/`to` are inclusive UTC days matched against
 * `appliedAt`, falling back to `createdAt` (same rule as the weekly stats).
 */
export const ApplicationListQuerySchema = z
  .object({
    /** Case-insensitive substring of the position, the company name or the location. */
    q: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(100).optional()),
    // A repeated query key arrives as an array, a single one as a string.
    status: z.preprocess(
      (value) => (value === undefined || Array.isArray(value) ? value : [value]),
      z.array(ApplicationStatusSchema).min(1).optional(),
    ),
    /** Exact tech stack entry (case-sensitive). */
    tech: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(50).optional()),
    workMode: z.preprocess(emptyToUndefined, WorkModeSchema.optional()),
    from: z.preprocess(emptyToUndefined, DateOnlySchema.optional()),
    to: z.preprocess(emptyToUndefined, DateOnlySchema.optional()),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "`from` must not be after `to`",
    path: ["to"],
  });
export type ApplicationListQuery = z.infer<typeof ApplicationListQuerySchema>;

/** Response of GET /applications/tech-stack: distinct entries, sorted. */
export const TechStackOptionsSchema = z.array(z.string());

const RateSchema = z.number().min(0).max(1).nullable();

/**
 * Response of GET /applications/stats. Conversion rates count every status an
 * application has reached: its current status plus its recorded status
 * history. Changes made before history was recorded (2026-11) aren't known,
 * so for older applications the rates can still undercount. Rates are null
 * when their denominator is 0.
 */
export const ApplicationStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  // An explicit object rather than z.record(): zod 3 infers a record with
  // enum keys as Partial, and every status is always present here.
  byStatus: z.object({
    APPLIED: z.number().int().nonnegative(),
    INTERVIEWING: z.number().int().nonnegative(),
    OFFER: z.number().int().nonnegative(),
    REJECTED: z.number().int().nonnegative(),
    WITHDRAWN: z.number().int().nonnegative(),
  }) satisfies z.ZodType<Record<ApplicationStatus, number>>,
  /** Oldest first; weekStart is the Monday (UTC) of each week as YYYY-MM-DD. */
  weekly: z.array(
    z.object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      count: z.number().int().nonnegative(),
    }),
  ),
  conversion: z.object({
    interviewRate: RateSchema,
    offerRate: RateSchema,
    offerFromInterviewRate: RateSchema,
  }),
  stale: z.object({
    count: z.number().int().nonnegative(),
    thresholdDays: z.number().int().positive(),
  }),
});
export type ApplicationStats = z.infer<typeof ApplicationStatsSchema>;
