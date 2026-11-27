import type { Contact, FollowUp } from "@job-tracker/types";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FollowUpForm } from "@/components/follow-up-form";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { FormState } from "@/lib/form-state";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** Server component; the per-follow-up actions are passed in as factories so this stays testable. */
export function FollowUpList({
  followUps,
  dueIds,
  contacts,
  createAction,
  updateAction,
  doneAction,
  deleteAction,
}: {
  /** Open ones first by day, then done ones, as the API returns them. */
  followUps: FollowUp[];
  /** Open follow-ups due today or earlier in the user's time zone (from GET /follow-ups/due). */
  dueIds: ReadonlySet<string>;
  contacts: Pick<Contact, "id" | "name">[];
  createAction: FormAction;
  updateAction: (followUpId: string) => FormAction;
  doneAction: (followUpId: string) => () => Promise<void>;
  deleteAction: (followUpId: string) => () => Promise<void>;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-medium">Follow-ups</h2>
      {followUps.length === 0 && <p className="text-sm text-muted-foreground">No follow-ups planned.</p>}
      {followUps.length > 0 && (
        <ul aria-label="Follow-ups" className="flex flex-col gap-2">
          {followUps.map((followUp) => {
            const done = followUp.doneAt !== null;
            const due = !done && dueIds.has(followUp.id);
            return (
              <li key={followUp.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className={done ? "text-muted-foreground line-through" : "font-medium"}>{followUp.note}</span>
                  <span className={due ? "font-medium text-red-600" : "text-muted-foreground"}>
                    {done ? `Done ${formatDate(followUp.doneAt)}` : `${due ? "Due" : "On"} ${formatDate(followUp.dueDate)}`}
                  </span>
                </div>
                {followUp.contact && <p className="text-muted-foreground">With {followUp.contact.name}</p>}
                <div className="flex items-start gap-2">
                  {!done && (
                    <>
                      <details className="flex-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground">Edit</summary>
                        <div className="pt-3">
                          <FollowUpForm
                            action={updateAction(followUp.id)}
                            followUp={followUp}
                            contacts={contacts}
                            submitLabel="Save"
                          />
                        </div>
                      </details>
                      <form action={doneAction(followUp.id)}>
                        <Button type="submit" size="sm">
                          Done
                        </Button>
                      </form>
                    </>
                  )}
                  <div className={done ? "ml-auto" : undefined}>
                    <ConfirmSubmitButton
                      action={deleteAction(followUp.id)}
                      confirmMessage="Remove this follow-up?"
                      label="Remove"
                      size="sm"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Plan a follow-up</summary>
        <div className="pt-3">
          <FollowUpForm action={createAction} contacts={contacts} submitLabel="Add follow-up" />
        </div>
      </details>
    </section>
  );
}
