import type { Activity } from "@job-tracker/types";
import { activityLabel } from "@/lib/activity";
import { formatDate } from "@/lib/format";

/** Expects activities newest first, as GET /applications/:id/activities returns them. */
export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-medium">History</h2>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <ol aria-label="Application history" className="flex flex-col gap-2">
          {activities.map((activity) => (
            <li key={activity.id} className="flex items-baseline justify-between gap-4 text-sm">
              <span>{activityLabel(activity)}</span>
              <time dateTime={activity.createdAt} className="shrink-0 text-muted-foreground">
                {formatDate(activity.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
