import { z } from "zod";

/** Shape of a validation error response returned by the API. */
export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
