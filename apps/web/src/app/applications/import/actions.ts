"use server";

import { revalidatePath } from "next/cache";
import { ApplicationImportResultSchema } from "@job-tracker/types";
import { ApiError } from "@/lib/api-client";
import { parseImportErrorBody, validateCsvFile, type CsvImportState } from "@/lib/csv-import";
import { serverApiFetch } from "@/lib/session";

export async function importApplications(_state: CsvImportState, formData: FormData): Promise<CsvImportState> {
  const checked = validateCsvFile(formData.get("file"));
  if ("error" in checked) {
    return { error: checked.error };
  }

  try {
    const result = await serverApiFetch("/applications/import", ApplicationImportResultSchema, {
      method: "POST",
      body: JSON.stringify({ csv: await checked.file.text() }),
    });
    revalidatePath("/applications");
    return { result };
  } catch (error) {
    // Non-API errors include Next's redirect signal — let them through.
    if (!(error instanceof ApiError)) throw error;
    const rowErrors = error.status === 400 ? parseImportErrorBody(error.message) : undefined;
    if (rowErrors) {
      return { error: "Nothing was imported. Fix these rows and upload the file again.", rowErrors };
    }
    return { error: "Something went wrong. Please try again." };
  }
}
