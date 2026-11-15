/**
 * Minimal RFC 4180 CSV reader/writer — enough for the application
 * import/export, without adding a library.
 */

export class CsvParseError extends Error {
  constructor(
    message: string,
    /** 1-based line where the problem was found. */
    public readonly line: number,
  ) {
    super(message);
    this.name = "CsvParseError";
  }
}

export type CsvRecord = {
  /** 1-based line the record starts on, so errors point at what the user sees in an editor. */
  line: number;
  cells: string[];
};

/**
 * Parses quoted fields, `""` escapes, line breaks inside quotes and CRLF / LF
 * endings, and drops a leading UTF-8 BOM. Blank lines are skipped. Throws
 * CsvParseError on an unclosed quote or text right after a closing quote.
 */
export function parseCsv(text: string): CsvRecord[] {
  const input = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const records: CsvRecord[] = [];

  let cells: string[] = [];
  let cell = "";
  let line = 1;
  let recordLine = 1;
  let inQuotes = false;
  let quoteLine = 1;
  // Whether the current cell was quoted, so `"",""` isn't mistaken for a blank line.
  let sawContent = false;

  const endRecord = () => {
    cells.push(cell);
    const blank = cells.length === 1 && cells[0] === "" && !sawContent;
    if (!blank) records.push({ line: recordLine, cells });
    cells = [];
    cell = "";
    sawContent = false;
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
          const next = input[i + 1];
          if (next !== undefined && next !== "," && next !== "\n" && next !== "\r") {
            throw new CsvParseError("Unexpected character after a closing quote", line);
          }
        }
      } else {
        if (char === "\n") line++;
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell === "") {
      inQuotes = true;
      quoteLine = line;
      sawContent = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
      sawContent = true;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      cell += char;
    }
  }

  if (inQuotes) {
    throw new CsvParseError("Unclosed quote", quoteLine);
  }
  endRecord();
  return records;
}

/**
 * Cells starting with one of these are run as formulas by Excel / Sheets
 * ("CSV injection"), so they're written with a leading `'`.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function protectCell(value: string): string {
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

/** Reverses protectCell, so an export → import round trip keeps the original text. */
export function unprotectCell(value: string): string {
  return value.startsWith("'") && FORMULA_TRIGGER.test(value.slice(1)) ? value.slice(1) : value;
}

function quoteCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CRLF line endings and a UTF-8 BOM, which Excel needs to read non-ASCII text (e.g. "ş", "ğ") correctly. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const body = rows.map((row) => row.map((cell) => quoteCell(protectCell(cell))).join(",")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}
