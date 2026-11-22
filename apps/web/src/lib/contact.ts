import { CreateContactInputSchema, UpdateContactInputSchema } from "@job-tracker/types";

const OPTIONAL_FIELDS = ["role", "email", "phone", "linkedinUrl", "notes"] as const;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Empty optional fields are left out. */
export function parseCreateContactForm(formData: FormData) {
  const optional = Object.fromEntries(
    OPTIONAL_FIELDS.map((key) => [key, field(formData, key)]).filter(([, value]) => value !== ""),
  );
  return CreateContactInputSchema.safeParse({ name: field(formData, "name"), ...optional });
}

/** The edit form always sends every field; an empty optional field clears it. */
export function parseUpdateContactForm(formData: FormData) {
  const optional = Object.fromEntries(OPTIONAL_FIELDS.map((key) => [key, field(formData, key) || null]));
  return UpdateContactInputSchema.safeParse({ name: field(formData, "name"), ...optional });
}
