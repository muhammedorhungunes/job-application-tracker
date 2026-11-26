"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import {
  ActivitySchema,
  ApplicationSchema,
  ApplicationStatusSchema,
  ContactSchema,
  FollowUpSchema,
  InterviewSchema,
  type Application,
  type ApplicationStatus,
} from "@job-tracker/types";
import { ApiError } from "@/lib/api-client";
import { parseCreateApplicationForm, parseUpdateApplicationForm } from "@/lib/application-form";
import { parseCreateContactForm, parseUpdateContactForm } from "@/lib/contact";
import { parseCreateFollowUpForm, parseUpdateFollowUpForm } from "@/lib/follow-up";
import { formStateFromZodError, type FormState } from "@/lib/form-state";
import { parseCreateInterviewForm, parseNoteForm, parseUpdateInterviewForm } from "@/lib/interview";
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

const StatusUpdateSchema = z.object({ id: z.string().min(1), status: ApplicationStatusSchema });

/** Called directly from the Kanban board (not a form), so the arguments are re-validated here. */
export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<{ error?: string }> {
  const parsed = StatusUpdateSchema.safeParse({ id, status });
  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  try {
    await serverApiFetch(applicationPath(parsed.data.id), ApplicationSchema, {
      method: "PATCH",
      body: JSON.stringify({ status: parsed.data.status }),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/applications");
  revalidatePath(applicationPath(parsed.data.id));
  return {};
}

export async function archiveApplication(id: string): Promise<void> {
  try {
    await serverApiFetch(applicationPath(id), z.undefined(), { method: "DELETE" });
  } catch (error) {
    // Already archived (e.g. in another tab) — same end result.
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  revalidatePath("/applications");
  revalidatePath("/applications/archived");
  redirect("/applications");
}

export async function restoreApplication(id: string): Promise<void> {
  try {
    await serverApiFetch(`${applicationPath(id)}/restore`, ApplicationSchema, { method: "POST" });
  } catch (error) {
    // Already restored (e.g. in another tab) — same end result.
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  revalidatePath("/applications");
  revalidatePath("/applications/archived");
}

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(formData) as Record<string, string>;
}

export async function addNote(applicationId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseNoteForm(formData);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  try {
    await serverApiFetch(`${applicationPath(applicationId)}/notes`, ActivitySchema, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR, values: formValues(formData) };
  }

  revalidatePath(applicationPath(applicationId));
  return {};
}

export async function deleteNote(applicationId: string, noteId: string): Promise<void> {
  try {
    await serverApiFetch(`${applicationPath(applicationId)}/notes/${encodeURIComponent(noteId)}`, z.undefined(), {
      method: "DELETE",
    });
  } catch (error) {
    // Already gone — same end result.
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  revalidatePath(applicationPath(applicationId));
}

function interviewsPath(applicationId: string): string {
  return `${applicationPath(applicationId)}/interviews`;
}

export async function createInterview(applicationId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseCreateInterviewForm(formData);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  try {
    await serverApiFetch(interviewsPath(applicationId), InterviewSchema, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR, values: formValues(formData) };
  }

  revalidatePath(applicationPath(applicationId));
  return {};
}

export async function updateInterview(
  applicationId: string,
  interviewId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseUpdateInterviewForm(formData);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  try {
    await serverApiFetch(`${interviewsPath(applicationId)}/${encodeURIComponent(interviewId)}`, InterviewSchema, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR, values: formValues(formData) };
  }

  revalidatePath(applicationPath(applicationId));
  return { message: "Saved" };
}

export async function cancelInterview(applicationId: string, interviewId: string): Promise<void> {
  try {
    await serverApiFetch(`${interviewsPath(applicationId)}/${encodeURIComponent(interviewId)}`, z.undefined(), {
      method: "DELETE",
    });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  revalidatePath(applicationPath(applicationId));
}

function contactsPath(applicationId: string): string {
  return `${applicationPath(applicationId)}/contacts`;
}

export async function createContact(applicationId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseCreateContactForm(formData);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  try {
    await serverApiFetch(contactsPath(applicationId), ContactSchema, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR, values: formValues(formData) };
  }

  revalidatePath(applicationPath(applicationId));
  return {};
}

export async function updateContact(
  applicationId: string,
  contactId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseUpdateContactForm(formData);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  try {
    await serverApiFetch(`${contactsPath(applicationId)}/${encodeURIComponent(contactId)}`, ContactSchema, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR, values: formValues(formData) };
  }

  revalidatePath(applicationPath(applicationId));
  return { message: "Saved" };
}

export async function deleteContact(applicationId: string, contactId: string): Promise<void> {
  try {
    await serverApiFetch(`${contactsPath(applicationId)}/${encodeURIComponent(contactId)}`, z.undefined(), {
      method: "DELETE",
    });
  } catch (error) {
    // Already removed (e.g. in another tab) — same end result.
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  revalidatePath(applicationPath(applicationId));
}

function followUpsPath(applicationId: string): string {
  return `${applicationPath(applicationId)}/follow-ups`;
}

/** The board lists due follow-ups too, so both pages are refreshed. */
function revalidateFollowUps(applicationId: string): void {
  revalidatePath(applicationPath(applicationId));
  revalidatePath("/applications");
}

export async function createFollowUp(applicationId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseCreateFollowUpForm(formData);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  try {
    await serverApiFetch(followUpsPath(applicationId), FollowUpSchema, {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR, values: formValues(formData) };
  }

  revalidateFollowUps(applicationId);
  return {};
}

export async function updateFollowUp(
  applicationId: string,
  followUpId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseUpdateFollowUpForm(formData);
  if (!parsed.success) {
    return formStateFromZodError(parsed.error, formData);
  }

  try {
    await serverApiFetch(`${followUpsPath(applicationId)}/${encodeURIComponent(followUpId)}`, FollowUpSchema, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { error: GENERIC_ERROR, values: formValues(formData) };
  }

  revalidateFollowUps(applicationId);
  return { message: "Saved" };
}

export async function completeFollowUp(applicationId: string, followUpId: string): Promise<void> {
  try {
    await serverApiFetch(`${followUpsPath(applicationId)}/${encodeURIComponent(followUpId)}/done`, FollowUpSchema, {
      method: "POST",
    });
  } catch (error) {
    // Removed or already done (e.g. in another tab) — nothing left to do.
    if (!(error instanceof ApiError && (error.status === 404 || error.status === 400))) throw error;
  }

  revalidateFollowUps(applicationId);
}

export async function deleteFollowUp(applicationId: string, followUpId: string): Promise<void> {
  try {
    await serverApiFetch(`${followUpsPath(applicationId)}/${encodeURIComponent(followUpId)}`, z.undefined(), {
      method: "DELETE",
    });
  } catch (error) {
    // Already removed (e.g. in another tab) — same end result.
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  revalidateFollowUps(applicationId);
}
