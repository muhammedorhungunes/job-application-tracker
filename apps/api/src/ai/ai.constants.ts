export const JOB_POSTING_QUEUE = "ai-job-posting";
export const EXTRACT_JOB_POSTING_JOB = "extract";

export interface ExtractJobPostingJobData {
  parseId: string;
}

/** Shown to the user when every attempt failed. Raw model output never is. */
export const PARSE_FAILED_MESSAGE = "Couldn't read this posting. Please fill in the form manually.";
