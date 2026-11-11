import { UpdateUserSettingsInputSchema } from "@job-tracker/types";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The form always sends every setting. Empty time zone / days mean "use the
 * default" (null), and an unchecked checkbox is simply absent from FormData.
 */
export function parseSettingsForm(formData: FormData) {
  const staleDays = field(formData, "staleDays");
  return UpdateUserSettingsInputSchema.safeParse({
    name: field(formData, "name"),
    timeZone: field(formData, "timeZone") || null,
    staleDigestEnabled: formData.get("staleDigestEnabled") === "on",
    // Number("abc") is NaN, which the schema rejects with a field error.
    staleDays: staleDays === "" ? null : Number(staleDays),
    interviewRemindersEnabled: formData.get("interviewRemindersEnabled") === "on",
  });
}

/**
 * Options for the time zone picker. Node's list leaves out "UTC" and only
 * has canonical names, which is also what the API stores; a stored zone
 * missing from the list is kept so the select can still show it.
 */
export function timeZoneOptions(current: string | null, supported: readonly string[]): string[] {
  const zones = new Set(supported);
  zones.add("UTC");
  if (current) zones.add(current);
  return [...zones].sort();
}
