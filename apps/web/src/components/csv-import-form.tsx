"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { importSummary, initialCsvImportState, type CsvImportState } from "@/lib/csv-import";

export function CsvImportForm({
  action,
}: {
  action: (state: CsvImportState, formData: FormData) => Promise<CsvImportState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialCsvImportState);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          aria-label="CSV file"
          className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </form>

      {state.result && (
        <div role="status" className="flex flex-wrap items-center gap-3 text-sm">
          <span>{importSummary(state.result)}</span>
          <Link href="/applications" prefetch={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Back to applications
          </Link>
        </div>
      )}

      {state.error && (
        <div role="alert" className="flex flex-col gap-2 text-sm text-red-600">
          <p>{state.error}</p>
          {state.rowErrors && (
            <ul className="list-disc pl-5">
              {state.rowErrors.map(({ row, messages }) => (
                <li key={row}>
                  {row > 0 ? `Row ${row}: ` : ""}
                  {messages.join("; ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
