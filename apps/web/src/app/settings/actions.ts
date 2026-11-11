"use server";

import { revalidatePath } from "next/cache";
import { UserSettingsSchema } from "@job-tracker/types";
import { ApiError } from "@/lib/api-client";
import { formStateFromZodError, type FormState } from "@/lib/form-state";
import { serverApiFetch } from "@/lib/session";
import { parseSettingsForm } from "@/lib/settings-form";

export async function updateSettings(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseSettingsForm(formData);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  try {
    await serverApiFetch("/settings", UserSettingsSchema, { method: "PATCH", body: JSON.stringify(parsed.data) });
  } catch (error) {
    // Non-API errors include Next's redirect signal — let them through.
    if (!(error instanceof ApiError)) throw error;
    return { error: "Something went wrong. Please try again.", values: Object.fromEntries(formData) as Record<string, string> };
  }

  revalidatePath("/settings");
  // The stale count on the stats page follows the threshold.
  revalidatePath("/applications/stats");
  return { message: "Settings saved" };
}
