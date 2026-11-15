import {
  ApplicationImportErrorSchema,
  CSV_IMPORT_MAX_LENGTH,
  type ApplicationImportError,
  type ApplicationImportResult,
} from "@job-tracker/types";

/** State of the CSV import form (driven by `useActionState`). */
export interface CsvImportState {
  error?: string;
  rowErrors?: ApplicationImportError["rows"];
  result?: ApplicationImportResult;
}

export const initialCsvImportState: CsvImportState = {};

/** Bytes; the API limit is in characters, which a file this size can't exceed. */
export const CSV_IMPORT_MAX_BYTES = CSV_IMPORT_MAX_LENGTH;

/** Checks the uploaded file before it's read and sent to the API. */
export function validateCsvFile(value: FormDataEntryValue | null): { file: File } | { error: string } {
  if (!(value instanceof File) || value.size === 0) {
    return { error: "Choose a CSV file to import." };
  }
  if (value.size > CSV_IMPORT_MAX_BYTES) {
    return { error: "The file is larger than 1 MB." };
  }
  return { file: value };
}

/** The API's 400 body for a rejected file, or undefined when it's some other 400. */
export function parseImportErrorBody(body: string): ApplicationImportError["rows"] | undefined {
  try {
    const parsed = ApplicationImportErrorSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data.rows : undefined;
  } catch {
    return undefined;
  }
}

export function importSummary(result: ApplicationImportResult): string {
  const imported = `${result.imported} application${result.imported === 1 ? "" : "s"} imported`;
  if (result.skippedDuplicates === 0) return `${imported}.`;
  const skipped = `${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? "" : "s"} skipped`;
  return `${imported}, ${skipped}.`;
}
