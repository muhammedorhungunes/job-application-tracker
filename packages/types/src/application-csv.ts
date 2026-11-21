import { z } from "zod";

/**
 * Column order of GET /applications/export. Import matches headers by name
 * (any order, unknown columns ignored); `createdAt` / `updatedAt` are export
 * only and ignored on import.
 */
export const APPLICATION_CSV_COLUMNS = [
  "position",
  "company",
  "status",
  "source",
  "url",
  "appliedAt",
  "techStack",
  "location",
  "workMode",
  "salaryMin",
  "salaryMax",
  "salaryCurrency",
  "salaryPeriod",
  "notes",
  "createdAt",
  "updatedAt",
] as const;
export type ApplicationCsvColumn = (typeof APPLICATION_CSV_COLUMNS)[number];

/** Headers an import file must contain. */
export const APPLICATION_CSV_REQUIRED_COLUMNS = ["position", "company"] as const satisfies readonly ApplicationCsvColumn[];

/** Separator between entries of the `techStack` cell. */
export const CSV_TECH_STACK_SEPARATOR = ";";

export const CSV_IMPORT_MAX_ROWS = 1000;
/** Characters, which for typical CSV is close to bytes; the web form checks the file size before sending. */
export const CSV_IMPORT_MAX_LENGTH = 1_000_000;

/** Body of POST /applications/import: the file's text. */
export const ApplicationImportInputSchema = z.object({
  csv: z.string().min(1).max(CSV_IMPORT_MAX_LENGTH),
});
export type ApplicationImportInput = z.infer<typeof ApplicationImportInputSchema>;

/** Response of a successful POST /applications/import. */
export const ApplicationImportResultSchema = z.object({
  imported: z.number().int().nonnegative(),
  skippedDuplicates: z.number().int().nonnegative(),
});
export type ApplicationImportResult = z.infer<typeof ApplicationImportResultSchema>;

/**
 * 400 body of POST /applications/import when the file is rejected. Nothing
 * is saved in that case. `row` is the 1-based line of the record in the file
 * (the header is row 1); 0 means a file-level problem (e.g. missing header).
 */
export const ApplicationImportErrorSchema = z.object({
  rows: z
    .array(z.object({ row: z.number().int().nonnegative(), messages: z.array(z.string()).min(1) }))
    .min(1),
});
export type ApplicationImportError = z.infer<typeof ApplicationImportErrorSchema>;
