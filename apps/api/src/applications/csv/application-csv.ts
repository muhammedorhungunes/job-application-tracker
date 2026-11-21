import {
  APPLICATION_CSV_COLUMNS,
  APPLICATION_CSV_REQUIRED_COLUMNS,
  CSV_IMPORT_MAX_ROWS,
  CSV_TECH_STACK_SEPARATOR,
  CreateApplicationInputSchema,
  type Application,
  type ApplicationCsvColumn,
  type ApplicationImportError,
  type CreateApplicationInput,
} from "@job-tracker/types";
import { CsvParseError, parseCsv, toCsv, unprotectCell, type CsvRecord } from "./csv";

type RowError = ApplicationImportError["rows"][number];

export type CsvImportRow = { line: number; input: CreateApplicationInput };

export type CsvImportParseResult = { ok: true; rows: CsvImportRow[] } | { ok: false; errors: RowError[] };

export function applicationsToCsv(applications: readonly Application[]): string {
  const values = (app: Application): Record<ApplicationCsvColumn, string> => ({
    position: app.position,
    company: app.company.name,
    status: app.status,
    source: app.source ?? "",
    url: app.url ?? "",
    // The form only sets a day, so the time part would just be noise in a spreadsheet.
    appliedAt: app.appliedAt?.slice(0, 10) ?? "",
    techStack: app.techStack.join(`${CSV_TECH_STACK_SEPARATOR} `),
    location: app.location ?? "",
    workMode: app.workMode ?? "",
    salaryMin: app.salaryMin ?? "",
    salaryMax: app.salaryMax ?? "",
    salaryCurrency: app.salaryCurrency ?? "",
    salaryPeriod: app.salaryPeriod ?? "",
    notes: app.notes ?? "",
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  });
  return toCsv([APPLICATION_CSV_COLUMNS, ...applications.map((app) => APPLICATION_CSV_COLUMNS.map((c) => values(app)[c]))]);
}

/** CreateApplicationInput key → CSV column, for error messages in the user's terms. */
const INPUT_KEY_TO_COLUMN: Record<string, ApplicationCsvColumn> = { companyName: "company" };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Turns the file into create inputs, validated with the same schema as
 * POST /applications. Collects every row's problems instead of stopping at
 * the first, so the user can fix the whole file in one go.
 */
export function csvToImportRows(text: string): CsvImportParseResult {
  let records: CsvRecord[];
  try {
    records = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvParseError) {
      return { ok: false, errors: [{ row: error.line, messages: [error.message] }] };
    }
    throw error;
  }

  const [header, ...data] = records;
  if (!header) {
    return { ok: false, errors: [{ row: 0, messages: ["The file is empty"] }] };
  }

  const index = new Map<ApplicationCsvColumn, number>();
  header.cells.forEach((name, i) => {
    const column = APPLICATION_CSV_COLUMNS.find((c) => c.toLowerCase() === name.trim().toLowerCase());
    if (column && !index.has(column)) index.set(column, i);
  });
  const missing = APPLICATION_CSV_REQUIRED_COLUMNS.filter((c) => !index.has(c));
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [{ row: header.line, messages: [`Missing required column(s): ${missing.join(", ")}`] }],
    };
  }
  if (data.length === 0) {
    return { ok: false, errors: [{ row: 0, messages: ["The file has no applications"] }] };
  }
  if (data.length > CSV_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      errors: [{ row: 0, messages: [`Too many rows: ${data.length} (at most ${CSV_IMPORT_MAX_ROWS})`] }],
    };
  }

  const rows: CsvImportRow[] = [];
  const errors: RowError[] = [];

  for (const record of data) {
    const cell = (column: ApplicationCsvColumn): string | undefined => {
      const i = index.get(column);
      const value = i === undefined ? undefined : unprotectCell(record.cells[i] ?? "").trim();
      return value ? value : undefined;
    };

    const messages: string[] = [];
    let appliedAt = cell("appliedAt");
    if (appliedAt && DATE_ONLY.test(appliedAt)) {
      if (isRealDay(appliedAt)) {
        appliedAt = `${appliedAt}T00:00:00.000Z`;
      } else {
        messages.push("appliedAt: not a real date");
        appliedAt = undefined;
      }
    }
    const techStack = cell("techStack")
      ?.split(CSV_TECH_STACK_SEPARATOR)
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "");

    const parsed = CreateApplicationInputSchema.safeParse({
      position: cell("position"),
      companyName: cell("company"),
      status: cell("status")?.toUpperCase(),
      source: cell("source"),
      url: cell("url"),
      appliedAt,
      notes: cell("notes"),
      techStack: techStack && techStack.length > 0 ? techStack : undefined,
      location: cell("location"),
      workMode: cell("workMode")?.toUpperCase(),
      salaryMin: cell("salaryMin"),
      salaryMax: cell("salaryMax"),
      salaryCurrency: cell("salaryCurrency"),
      salaryPeriod: cell("salaryPeriod")?.toUpperCase(),
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        const column = INPUT_KEY_TO_COLUMN[key] ?? key;
        const message = column === "appliedAt" ? "use YYYY-MM-DD" : issue.message;
        messages.push(column ? `${column}: ${message}` : message);
      }
    }

    if (messages.length > 0) {
      errors.push({ row: record.line, messages: [...new Set(messages)] });
    } else if (parsed.success) {
      rows.push({ line: record.line, input: parsed.data });
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, rows };
}
