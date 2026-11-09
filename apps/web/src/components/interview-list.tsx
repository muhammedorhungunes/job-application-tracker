import type { Interview } from "@job-tracker/types";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InterviewForm } from "@/components/interview-form";
import { LocalDateTime } from "@/components/local-date-time";
import type { FormState } from "@/lib/form-state";
import { formatInterviewKind } from "@/lib/interview";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** Server component; the per-interview actions are passed in as factories so this stays testable. */
export function InterviewList({
  interviews,
  now,
  createAction,
  updateAction,
  cancelAction,
}: {
  /** Soonest first, as the API returns them. */
  interviews: Interview[];
  now: Date;
  createAction: FormAction;
  updateAction: (interviewId: string) => FormAction;
  cancelAction: (interviewId: string) => () => Promise<void>;
}) {
  const upcoming = interviews.filter((i) => new Date(i.scheduledAt) >= now);
  // Most recent past interview first.
  const past = interviews.filter((i) => new Date(i.scheduledAt) < now).reverse();

  const renderGroup = (title: string, items: Interview[]) =>
    items.length > 0 && (
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <ul aria-label={`${title} interviews`} className="flex flex-col gap-2">
          {items.map((interview) => (
            <li key={interview.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{formatInterviewKind(interview.kind)}</span>
                <LocalDateTime iso={interview.scheduledAt} />
              </div>
              {interview.notes && <p className="whitespace-pre-wrap text-muted-foreground">{interview.notes}</p>}
              <div className="flex items-start gap-2">
                <details className="flex-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">Edit</summary>
                  <div className="pt-3">
                    <InterviewForm action={updateAction(interview.id)} interview={interview} submitLabel="Save" />
                  </div>
                </details>
                <ConfirmSubmitButton
                  action={cancelAction(interview.id)}
                  confirmMessage="Cancel this interview?"
                  label="Cancel interview"
                  size="sm"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-medium">Interviews</h2>
      {interviews.length === 0 && <p className="text-sm text-muted-foreground">No interviews scheduled.</p>}
      {renderGroup("Upcoming", upcoming)}
      {renderGroup("Past", past)}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Schedule an interview</summary>
        <div className="pt-3">
          <InterviewForm action={createAction} submitLabel="Schedule" />
        </div>
      </details>
    </section>
  );
}
