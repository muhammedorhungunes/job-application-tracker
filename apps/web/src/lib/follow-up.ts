import { CreateFollowUpInputSchema, UpdateFollowUpInputSchema } from "@job-tracker/types";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** "No contact" is the empty option, which is left out. */
export function parseCreateFollowUpForm(formData: FormData) {
  const contactId = field(formData, "contactId");
  return CreateFollowUpInputSchema.safeParse({
    dueDate: field(formData, "dueDate"),
    note: field(formData, "note"),
    ...(contactId ? { contactId } : {}),
  });
}

/** The edit form always sends every field; "No contact" clears it. */
export function parseUpdateFollowUpForm(formData: FormData) {
  return UpdateFollowUpInputSchema.safeParse({
    dueDate: field(formData, "dueDate"),
    note: field(formData, "note"),
    contactId: field(formData, "contactId") || null,
  });
}
