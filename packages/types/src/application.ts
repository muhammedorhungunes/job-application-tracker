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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  company: CompanySummarySchema,
});
export type Application = z.infer<typeof ApplicationSchema>;

export const TechStackSchema = z.array(z.string().trim().min(1).max(50)).max(30);

/**
 * Input for creating an application. There's no company-picker endpoint yet,
 * so the client sends a plain company name and the backend finds-or-creates
 * the Company row by it (see ApplicationsService.getOrCreateCompany).
 */
export const CreateApplicationInputSchema = z.object({
  position: z.string().trim().min(1).max(200),
  companyName: z.string().trim().min(1).max(200),
  status: ApplicationStatusSchema.optional(),
  source: z.string().trim().min(1).max(200).optional(),
  url: z.string().trim().url().optional(),
  appliedAt: z.string().datetime().optional(),
  notes: z.string().trim().min(1).max(5000).optional(),
  techStack: TechStackSchema.optional(),
});
export type CreateApplicationInput = z.infer<typeof CreateApplicationInputSchema>;

/**
 * Input for a partial update (PATCH). Every field is optional so the client
 * only sends what changed. The `source`/`url`/`appliedAt`/`notes` fields are
 * also `.nullable()` (unlike in create) so a client can explicitly clear a
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
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one field to update" });
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationInputSchema>;

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
