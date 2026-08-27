import { z } from "zod";

/**
 * Mirrors prisma/schema.prisma's `ApplicationStatus` enum by hand — Prisma
 * enums can't be imported into plain TypeScript. Keep both lists in sync
 * whenever one changes.
 */
export const ApplicationStatusValues = [
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
] as const;
export const ApplicationStatusSchema = z.enum(ApplicationStatusValues);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
