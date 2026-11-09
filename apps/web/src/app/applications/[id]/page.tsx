import { notFound } from "next/navigation";
import type { z } from "zod";
import {
  ActivitySchema,
  ApplicationSchema,
  InterviewSchema,
  type Activity,
  type Application,
  type Interview,
} from "@job-tracker/types";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InterviewList } from "@/components/interview-list";
import { ApplicationForm } from "@/components/application-form";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { serverApiFetch } from "@/lib/session";
import {
  addNote,
  cancelInterview,
  createInterview,
  deleteApplication,
  deleteNote,
  updateApplication,
  updateInterview,
} from "../actions";

async function getApplication(id: string): Promise<Application> {
  try {
    return await serverApiFetch(`/applications/${encodeURIComponent(id)}`, ApplicationSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

// Sub-resources are fetched in parallel with the application: a missing
// application is reported by getApplication's notFound(), so a 404 on these
// just yields an empty list.
async function getSubresource<T>(path: string, schema: z.ZodType<T[]>): Promise<T[]> {
  try {
    return await serverApiFetch(path, schema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = `/applications/${encodeURIComponent(id)}`;
  const [application, activities, interviews] = await Promise.all([
    getApplication(id),
    getSubresource<Activity>(`${base}/activities`, ActivitySchema.array()),
    getSubresource<Interview>(`${base}/interviews`, InterviewSchema.array()),
  ]);

  return (
    // The layout is wide for the Kanban board; forms read better narrower.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{application.position}</h1>
          <p className="text-muted-foreground">{application.company.name}</p>
          <p className="text-sm text-muted-foreground">Last updated {formatDate(application.updatedAt)}</p>
        </div>
        <ConfirmSubmitButton
          action={deleteApplication.bind(null, id)}
          confirmMessage="Delete this application?"
          label="Delete"
        />
      </div>
      <ApplicationForm action={updateApplication.bind(null, id)} application={application} submitLabel="Save changes" />
      <InterviewList
        interviews={interviews}
        now={new Date()}
        createAction={createInterview.bind(null, id)}
        updateAction={(interviewId) => updateInterview.bind(null, id, interviewId)}
        cancelAction={(interviewId) => cancelInterview.bind(null, id, interviewId)}
      />
      <ActivityTimeline
        activities={activities}
        addNoteAction={addNote.bind(null, id)}
        deleteNoteAction={(noteId) => deleteNote.bind(null, id, noteId)}
      />
    </div>
  );
}
