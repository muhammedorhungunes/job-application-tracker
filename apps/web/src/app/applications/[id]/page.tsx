import { notFound } from "next/navigation";
import { ApplicationSchema, type Application } from "@job-tracker/types";
import { ApplicationForm } from "@/components/application-form";
import { DeleteApplicationButton } from "@/components/delete-application-button";
import { ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { serverApiFetch } from "@/lib/session";
import { deleteApplication, updateApplication } from "../actions";

async function getApplication(id: string): Promise<Application> {
  try {
    return await serverApiFetch(`/applications/${encodeURIComponent(id)}`, ApplicationSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await getApplication(id);

  return (
    // The layout is wide for the Kanban board; forms read better narrower.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{application.position}</h1>
          <p className="text-muted-foreground">{application.company.name}</p>
          <p className="text-sm text-muted-foreground">Last updated {formatDate(application.updatedAt)}</p>
        </div>
        <DeleteApplicationButton action={deleteApplication.bind(null, id)} />
      </div>
      <ApplicationForm action={updateApplication.bind(null, id)} application={application} submitLabel="Save changes" />
    </div>
  );
}
