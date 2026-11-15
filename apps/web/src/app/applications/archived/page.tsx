import { ArchivedApplicationSchema } from "@job-tracker/types";
import { ArchivedList } from "@/components/archived-list";
import { serverApiFetch } from "@/lib/session";
import { restoreApplication } from "../actions";

export default async function ArchivedApplicationsPage() {
  const applications = await serverApiFetch("/applications/archived", ArchivedApplicationSchema.array());

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Archived applications</h1>
        <p className="text-sm text-muted-foreground">
          Archived applications are hidden from the board, stats and reminders. Restoring one brings it back with its
          history, notes and interviews.
        </p>
      </div>
      <ArchivedList applications={applications} restoreAction={(id) => restoreApplication.bind(null, id)} />
    </div>
  );
}
