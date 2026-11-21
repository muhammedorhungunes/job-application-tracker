import { CSV_IMPORT_MAX_ROWS, type Application } from "@job-tracker/types";
import { applicationsToCsv, csvToImportRows } from "./application-csv";

const application: Application = {
  id: "app-1",
  position: "Backend Engineer",
  status: "INTERVIEWING",
  source: "LinkedIn",
  url: "https://example.com/job",
  appliedAt: "2026-11-02T00:00:00.000Z",
  notes: "=HYPERLINK(\"x\")",
  techStack: ["TypeScript", "NestJS"],
  location: "Berlin",
  workMode: "HYBRID",
  salaryMin: "60000.00",
  salaryMax: "75000.00",
  salaryCurrency: "EUR",
  salaryPeriod: "YEAR",
  createdAt: "2026-11-02T08:00:00.000Z",
  updatedAt: "2026-11-03T09:00:00.000Z",
  company: { id: "c-1", name: "Acme, Inc" },
};

describe("applicationsToCsv", () => {
  it("writes the header and one row per application", () => {
    const csv = applicationsToCsv([application]);
    const [header, row] = csv.replace("\uFEFF", "").split("\r\n");
    expect(header).toBe(
      "position,company,status,source,url,appliedAt,techStack,location,workMode,salaryMin,salaryMax,salaryCurrency," +
        "salaryPeriod,notes,createdAt,updatedAt",
    );
    expect(row).toBe(
      'Backend Engineer,"Acme, Inc",INTERVIEWING,LinkedIn,https://example.com/job,2026-11-02,TypeScript; NestJS,' +
        "Berlin,HYBRID,60000.00,75000.00,EUR,YEAR," +
        "\"'=HYPERLINK(\"\"x\"\")\",2026-11-02T08:00:00.000Z,2026-11-03T09:00:00.000Z",
    );
  });

  it("leaves location, work mode and salary cells empty when unset", () => {
    const csv = applicationsToCsv([
      {
        ...application,
        location: null,
        workMode: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
      },
    ]);
    const row = csv.replace("\uFEFF", "").split("\r\n")[1];
    expect(row).toContain("TypeScript; NestJS,,,,,,,");
  });

  it("round-trips through csvToImportRows", () => {
    const result = csvToImportRows(applicationsToCsv([application]));
    expect(result).toEqual({
      ok: true,
      rows: [
        {
          line: 2,
          input: {
            position: "Backend Engineer",
            companyName: "Acme, Inc",
            status: "INTERVIEWING",
            source: "LinkedIn",
            url: "https://example.com/job",
            appliedAt: "2026-11-02T00:00:00.000Z",
            notes: '=HYPERLINK("x")',
            techStack: ["TypeScript", "NestJS"],
            location: "Berlin",
            workMode: "HYBRID",
            salaryMin: "60000.00",
            salaryMax: "75000.00",
            salaryCurrency: "EUR",
            salaryPeriod: "YEAR",
          },
        },
      ],
    });
  });
});

describe("csvToImportRows", () => {
  it("matches headers by name in any order, case-insensitively, ignoring unknown columns", () => {
    const result = csvToImportRows("Company,extra,POSITION,status\nAcme,ignored,Dev,offer\n");
    expect(result).toEqual({
      ok: true,
      rows: [{ line: 2, input: { position: "Dev", companyName: "Acme", status: "OFFER" } }],
    });
  });

  it("treats empty cells as missing and splits the tech stack on ';'", () => {
    const result = csvToImportRows("position,company,source,techStack\nDev,Acme,, React ;;Go \n");
    expect(result).toEqual({
      ok: true,
      rows: [{ line: 2, input: { position: "Dev", companyName: "Acme", techStack: ["React", "Go"] } }],
    });
  });

  it("reads location, work mode and salary, accepting lower case enum values and currency", () => {
    const result = csvToImportRows(
      "position,company,location,workMode,salaryMin,salaryMax,salaryCurrency,salaryPeriod\n" +
        "Dev,Acme,Remote EU,remote,50000,,eur,month\n",
    );
    expect(result).toEqual({
      ok: true,
      rows: [
        {
          line: 2,
          input: {
            position: "Dev",
            companyName: "Acme",
            location: "Remote EU",
            workMode: "REMOTE",
            salaryMin: "50000",
            salaryCurrency: "EUR",
            salaryPeriod: "MONTH",
          },
        },
      ],
    });
  });

  it("reports salary problems by column", () => {
    const result = csvToImportRows(
      [
        "position,company,workMode,salaryMin,salaryMax,salaryCurrency,salaryPeriod",
        "Dev,Acme,,70000,60000,EUR,YEAR",
        "Ops,Acme,,50000,,,",
        "QA,Acme,office,lots,,EURO,DAY",
      ].join("\n"),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        { row: 2, messages: ["salaryMax: Maximum must not be below the minimum"] },
        {
          row: 3,
          messages: ["salaryCurrency: Choose a currency for the salary", "salaryPeriod: Choose a period for the salary"],
        },
        {
          row: 4,
          messages: [
            expect.stringMatching(/^workMode: /),
            "salaryMin: Enter an amount like 65000 or 65000.50",
            "salaryCurrency: Use a 3-letter currency code like EUR",
            expect.stringMatching(/^salaryPeriod: /),
          ],
        },
      ],
    });
  });

  it("accepts a full ISO datetime for appliedAt", () => {
    const result = csvToImportRows("position,company,appliedAt\nDev,Acme,2026-11-02T10:30:00.000Z\n");
    expect(result.ok && result.rows[0]?.input.appliedAt).toBe("2026-11-02T10:30:00.000Z");
  });

  it("collects every row's errors with their line numbers, in the user's column names", () => {
    const result = csvToImportRows(
      ["position,company,status,appliedAt,url", "Dev,Acme,,,", ",,MAYBE,2026-02-31,not-a-url", "Ops,Acme,,02/11/2026,"].join("\n"),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          row: 3,
          messages: [
            "appliedAt: not a real date",
            "position: Required",
            "company: Required",
            expect.stringMatching(/^status: /),
            "url: Invalid url",
          ],
        },
        { row: 4, messages: ["appliedAt: use YYYY-MM-DD"] },
      ],
    });
  });

  it("rejects a file without the required headers", () => {
    expect(csvToImportRows("title,employer\nDev,Acme")).toEqual({
      ok: false,
      errors: [{ row: 1, messages: ["Missing required column(s): position, company"] }],
    });
  });

  it("rejects an empty file and a header-only file", () => {
    expect(csvToImportRows("\n")).toEqual({ ok: false, errors: [{ row: 0, messages: ["The file is empty"] }] });
    expect(csvToImportRows("position,company\n")).toEqual({
      ok: false,
      errors: [{ row: 0, messages: ["The file has no applications"] }],
    });
  });

  it("rejects more than the row limit", () => {
    const csv = ["position,company", ...Array.from({ length: CSV_IMPORT_MAX_ROWS + 1 }, () => "Dev,Acme")].join("\n");
    const result = csvToImportRows(csv);
    expect(result.ok).toBe(false);
  });

  it("reports a malformed file at the line of the problem", () => {
    expect(csvToImportRows('position,company\n"Dev,Acme')).toEqual({
      ok: false,
      errors: [{ row: 2, messages: ["Unclosed quote"] }],
    });
  });
});
