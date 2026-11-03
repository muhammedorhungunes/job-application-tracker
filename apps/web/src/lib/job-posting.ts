import type { JobPostingExtraction } from "@job-tracker/types";
import { formatTechStack } from "@/lib/application-form";

/** Maps Claude's extraction onto ApplicationForm field names. */
export function extractionToFormValues(extraction: JobPostingExtraction): Record<string, string> {
  const values: Record<string, string> = {
    companyName: extraction.companyName,
    position: extraction.position,
    techStack: formatTechStack(extraction.techStack),
  };
  // Only a real http(s) URL; anything else would fail the form's url check.
  if (extraction.url && /^https?:\/\//i.test(extraction.url)) {
    values.url = extraction.url;
  }
  // There's no location field on an application yet, so it goes into notes.
  if (extraction.location) {
    values.notes = `Location: ${extraction.location}`;
  }
  return values;
}
