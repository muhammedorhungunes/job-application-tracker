import { z } from "zod";
// The Anthropic SDK's `zodOutputFormat` helper only accepts zod v4 schemas.
// zod 3.25 ships v4 under the `zod/v4` subpath, so the model-output schemas
// below use it; request-body schemas stay on v3 because ZodValidationPipe
// is typed against v3's ZodSchema.
import * as z4 from "zod/v4";

export const ParseJobPostingInputSchema = z.object({
  text: z.string().trim().min(50, "Paste the full posting (at least 50 characters)").max(30000),
});
export type ParseJobPostingInput = z.infer<typeof ParseJobPostingInputSchema>;

/** What Claude extracts from a pasted job posting. Also the shape that pre-fills the form. */
export const JobPostingExtractionSchema = z4.object({
  companyName: z4.string().min(1).max(200),
  position: z4.string().min(1).max(200),
  techStack: z4.array(z4.string().min(1).max(50)).max(30),
  location: z4.string().max(200).nullable(),
  url: z4.string().nullable(),
});
export type JobPostingExtraction = z4.infer<typeof JobPostingExtractionSchema>;

export const JobPostingParseStatusValues = ["PENDING", "COMPLETED", "FAILED"] as const;
export const JobPostingParseStatusSchema = z4.enum(JobPostingParseStatusValues);
export type JobPostingParseStatus = z4.infer<typeof JobPostingParseStatusSchema>;

/** A parse request as returned by the API. `result` is set only when COMPLETED. */
export const JobPostingParseSchema = z4.object({
  id: z4.string(),
  status: JobPostingParseStatusSchema,
  result: JobPostingExtractionSchema.nullable(),
  errorMessage: z4.string().nullable(),
  createdAt: z4.string(),
});
export type JobPostingParse = z4.infer<typeof JobPostingParseSchema>;
