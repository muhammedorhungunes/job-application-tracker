"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ApplicationSchema, type Application } from "@job-tracker/types";
import { ApiError } from "@/lib/api-client";
import { parseCreateApplicationForm, parseUpdateApplicationForm } from "@/lib/application-form";
import { formStateFromZodError, type FormState } from "@/lib/form-state";
import { serverApiFetch } from "@/lib/session";

const GENERIC_ERROR = "Something went wrong. Please try again.";

function applicationPath(id: string): string {
  return `/applications/${encodeURIComponent(id)}`;
}

export async function createApplication(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseCreateApplicationForm(formData);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  let created: Application;
  try {
    created = await serverApiFetch("/applications", ApplicationSchema, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    // Non-API errors include Next's redirect/notFound signals — let them through.
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR, values: Object.fromEntries(formData) as Record<string, string> };
  }

  revalidatePath("/applications");
  redirect(applicationPath(created.id));
}

export async function updateApplication(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  // Re-read the current record so only fields the user actually changed are sent.
  let current: Application;
  try {
    current = await serverApiFetch(applicationPath(id), ApplicationSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const parsed = parseUpdateApplicationForm(formData, current);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  try {
    await serverApiFetch(applicationPath(id), ApplicationSchema, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR, values: Object.fromEntries(formData) as Record<string, string> };
  }

  revalidatePath("/applications");
  revalidatePath(applicationPath(id));
  return { message: "Saved" };
}

export async function deleteApplication(id: string): Promise<void> {
  try {
    await serverApiFetch(applicationPath(id), z.undefined(), { method: "DELETE" });
  } catch (error) {
    // Already gone (e.g. deleted in another tab) — same end result.
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  revalidatePath("/applications");
  redirect("/applications");
}
