import type { Activity } from "@job-tracker/types";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { NoteForm } from "@/components/note-form";
import { activityLabel } from "@/lib/activity";
import { formatDate } from "@/lib/format";
import type { FormState } from "@/lib/form-state";

/**
 * Expects activities newest first, as GET /applications/:id/activities returns
 * them. Note actions are optional so the list can render read-only.
 */
export function ActivityTimeline({
  activities,
  addNoteAction,
  deleteNoteAction,
}: {
  activities: Activity[];
  addNoteAction?: (state: FormState, formData: FormData) => Promise<FormState>;
  deleteNoteAction?: (noteId: string) => () => Promise<void>;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-medium">History</h2>
      {addNoteAction && <NoteForm action={addNoteAction} />}
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <ol aria-label="Application history" className="flex flex-col gap-2">
          {activities.map((activity) => (
            <li key={activity.id} className="flex items-baseline justify-between gap-4 text-sm">
              <span className={activity.type === "NOTE" ? "whitespace-pre-wrap" : undefined}>
                {activityLabel(activity)}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <time dateTime={activity.createdAt} className="text-muted-foreground">
                  {formatDate(activity.createdAt)}
                </time>
                {activity.type === "NOTE" && deleteNoteAction && (
                  <ConfirmSubmitButton
                    action={deleteNoteAction(activity.id)}
                    confirmMessage="Delete this note?"
                    label="Delete"
                    size="sm"
                  />
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
