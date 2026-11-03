"use client";

import { useCallback, useState } from "react";
import type { JobPostingExtraction } from "@job-tracker/types";
import { ApplicationForm } from "@/components/application-form";
import { JobPostingImport } from "@/components/job-posting-import";
import { extractionToFormValues } from "@/lib/job-posting";
import type { FormState } from "@/lib/form-state";

export function NewApplicationPanel({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [prefill, setPrefill] = useState<{ values: Record<string, string>; version: number }>({
    values: {},
    version: 0,
  });

  const handleExtracted = useCallback((extraction: JobPostingExtraction) => {
    setPrefill((current) => ({ values: extractionToFormValues(extraction), version: current.version + 1 }));
  }, []);

  return (
    <>
      <JobPostingImport onExtracted={handleExtracted} />
      {prefill.version > 0 && (
        <p className="text-sm text-muted-foreground">Filled in from the posting. Check the fields before saving.</p>
      )}
      {/* The form's inputs are uncontrolled, so a new key remounts it with the extracted defaults. */}
      <ApplicationForm
        key={prefill.version}
        action={action}
        initialValues={prefill.values}
        submitLabel="Add application"
      />
    </>
  );
}
