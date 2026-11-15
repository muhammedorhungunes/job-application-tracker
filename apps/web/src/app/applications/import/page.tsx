import { APPLICATION_CSV_REQUIRED_COLUMNS, CSV_IMPORT_MAX_ROWS } from "@job-tracker/types";
import { CsvImportForm } from "@/components/csv-import-form";
import { importApplications } from "./actions";

export default function ImportApplicationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Import applications</h1>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Upload a CSV file with a header row. <code>{APPLICATION_CSV_REQUIRED_COLUMNS.join(", ")}</code> are required;{" "}
          <code>status</code>, <code>source</code>, <code>url</code>, <code>appliedAt</code> (YYYY-MM-DD),{" "}
          <code>techStack</code> (separated by <code>;</code>) and <code>notes</code> are optional. Other columns are
          ignored, so a file from &ldquo;Export CSV&rdquo; works as is.
        </p>
        <p>
          Up to {CSV_IMPORT_MAX_ROWS.toLocaleString("en")} rows and 1 MB. If any row is invalid, nothing is imported.
          Rows matching an application you already have (same company, position and applied date) are skipped.
        </p>
      </div>

      <CsvImportForm action={importApplications} />
    </div>
  );
}
