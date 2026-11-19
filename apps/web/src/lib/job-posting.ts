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
  if (extraction.location) values.location = extraction.location;
  if (extraction.workMode) values.workMode = extraction.workMode;
  Object.assign(values, salaryValues(extraction));
  return values;
}

/** Up to 2 decimals and 10 integer digits, like the form's MoneySchema. */
function toAmount(value: number | null): string | undefined {
  if (value === null || !Number.isFinite(value) || value <= 0 || value >= 1e10) return undefined;
  return String(Math.round(value * 100) / 100);
}

/**
 * The model's salary, cleaned up for the form. Anything unusable (no amount,
 * no recognisable currency or period) leaves the salary fields empty rather
 * than pre-filling something the user would have to fix.
 */
function salaryValues(extraction: JobPostingExtraction): Record<string, string> {
  let min = toAmount(extraction.salaryMin);
  let max = toAmount(extraction.salaryMax);
  const currency = extraction.salaryCurrency?.trim().toUpperCase();
  if (!(min || max) || !currency || !/^[A-Z]{3}$/.test(currency) || !extraction.salaryPeriod) return {};
  if (min && max && Number(min) > Number(max)) [min, max] = [max, min];
  return {
    ...(min && { salaryMin: min }),
    ...(max && { salaryMax: max }),
    salaryCurrency: currency,
    salaryPeriod: extraction.salaryPeriod,
  };
}
