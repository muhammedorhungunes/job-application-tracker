import type { ArchivedApplication } from "@job-tracker/types";
import { Button } from "@/components/ui/button";
import { formatDate, formatStatus } from "@/lib/format";

/** Server component: each Restore button is a plain form posting to a bound server action. */
export function ArchivedList({
  applications,
  restoreAction,
}: {
  applications: ArchivedApplication[];
  restoreAction: (id: string) => () => Promise<void>;
}) {
  if (applications.length === 0) {
    return <p className="text-muted-foreground">No archived applications.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
      {applications.map((application) => (
        <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium">{application.position}</p>
            <p className="text-sm text-muted-foreground">
              {application.company.name} · {formatStatus(application.status)} · Archived{" "}
              {formatDate(application.archivedAt)}
            </p>
          </div>
          <form action={restoreAction(application.id)}>
            <Button type="submit" variant="outline" size="sm">
              Restore
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
