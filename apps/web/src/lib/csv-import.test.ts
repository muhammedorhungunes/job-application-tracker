import { describe, expect, it } from "vitest";
import { CSV_IMPORT_MAX_BYTES, importSummary, parseImportErrorBody, validateCsvFile } from "./csv-import";

describe("validateCsvFile", () => {
  it("requires a non-empty file", () => {
    expect(validateCsvFile(null)).toEqual({ error: "Choose a CSV file to import." });
    expect(validateCsvFile("text")).toEqual({ error: "Choose a CSV file to import." });
    expect(validateCsvFile(new File([], "empty.csv"))).toEqual({ error: "Choose a CSV file to import." });
  });

  it("rejects files over the size limit", () => {
    const big = new File(["x".repeat(CSV_IMPORT_MAX_BYTES + 1)], "big.csv");
    expect(validateCsvFile(big)).toEqual({ error: "The file is larger than 1 MB." });
  });

  it("accepts a file within the limit", () => {
    const file = new File(["position,company\nDev,Acme"], "ok.csv");
    expect(validateCsvFile(file)).toEqual({ file });
  });
});

describe("parseImportErrorBody", () => {
  it("returns the rows of an import error body", () => {
    const rows = [{ row: 2, messages: ["position: Required"] }];
    expect(parseImportErrorBody(JSON.stringify({ rows }))).toEqual(rows);
  });

  it("returns undefined for other 400 bodies and non-JSON", () => {
    expect(parseImportErrorBody(JSON.stringify({ fieldErrors: { csv: ["Required"] }, formErrors: [] }))).toBeUndefined();
    expect(parseImportErrorBody("Bad Request")).toBeUndefined();
  });
});

describe("importSummary", () => {
  it("pluralises and only mentions duplicates when there are some", () => {
    expect(importSummary({ imported: 1, skippedDuplicates: 0 })).toBe("1 application imported.");
    expect(importSummary({ imported: 0, skippedDuplicates: 2 })).toBe("0 applications imported, 2 duplicates skipped.");
  });
});
