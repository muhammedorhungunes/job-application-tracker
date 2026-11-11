import { z } from "zod";

/** True when `Intl` knows the IANA zone; works the same in Node and the browser. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const TimeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, { message: "Unknown time zone" })
  // Intl accepts any casing ("europe/istanbul"); store the canonical name so it matches the picker's options.
  .transform((timeZone) => new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone);

export const StaleDaysSchema = z.number().int().min(1).max(90);

/**
 * Response of GET /settings. `timeZone` / `staleDays` are the user's own
 * overrides; null means the server default in `defaults` applies.
 */
export const UserSettingsSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  timeZone: z.string().nullable(),
  staleDigestEnabled: z.boolean(),
  staleDays: z.number().int().nullable(),
  interviewRemindersEnabled: z.boolean(),
  defaults: z.object({
    timeZone: z.string(),
    staleDays: z.number().int().positive(),
  }),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

/** PATCH /settings. Omitted keys are left alone; null resets an override to the default. */
export const UpdateUserSettingsInputSchema = z
  .object({
    // Same rule as RegisterInputSchema.name.
    name: z.string().trim().min(1).max(100).optional(),
    timeZone: TimeZoneSchema.nullable().optional(),
    staleDigestEnabled: z.boolean().optional(),
    staleDays: StaleDaysSchema.nullable().optional(),
    interviewRemindersEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "Provide at least one setting to update" });
export type UpdateUserSettingsInput = z.infer<typeof UpdateUserSettingsInputSchema>;
