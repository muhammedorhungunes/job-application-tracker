"use server";

import { JobPostingParseSchema, ParseJobPostingInputSchema, type JobPostingParse } from "@job-tracker/types";
import { ApiError } from "@/lib/api-client";
import { serverApiFetch } from "@/lib/session";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export type JobPostingParseActionResult = { parse: JobPostingParse; error?: undefined } | { parse?: undefined; error: string };

/** Queues a Claude extraction on the API; the result is fetched later with getJobPostingParse. */
export async function requestJobPostingParse(text: string): Promise<JobPostingParseActionResult> {
  const parsed = ParseJobPostingInputSchema.safeParse({ text });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.text?.[0] ?? GENERIC_ERROR };
  }

  try {
    const parse = await serverApiFetch("/ai/job-postings", JobPostingParseSchema, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    return { parse };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR };
  }
}

export async function getJobPostingParse(id: string): Promise<JobPostingParseActionResult> {
  if (typeof id !== "string" || id.length === 0) {
    return { error: GENERIC_ERROR };
  }

  try {
    const parse = await serverApiFetch(`/ai/job-postings/${encodeURIComponent(id)}`, JobPostingParseSchema);
    return { parse };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR };
  }
}
