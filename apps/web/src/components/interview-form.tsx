"use client";

import { useActionState } from "react";
import { InterviewKindValues, type Interview } from "@job-tracker/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { initialFormState, type FormState } from "@/lib/form-state";
import { formatInterviewKind, isoToLocalInput, localInputToIso } from "@/lib/interview";
import { useIsClient } from "@/lib/use-is-client";

/**
 * The time is converted to ISO here, in the browser, because only the browser
 * knows the user's time zone; the server action receives `scheduledAt` ready.
 */
export function InterviewForm({
  action,
  interview,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  interview?: Interview;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const isClient = useIsClient();
  const idPrefix = interview ? `interview-${interview.id}` : "interview-new";
  const errors = (key: string): string[] | undefined => state.fieldErrors?.[key];

  // Local time can only be computed on the client; the key remounts the input
  // once it can, so its default value is set from the browser's zone.
  const storedLocal = interview && isClient ? isoToLocalInput(interview.scheduledAt) : "";

  return (
    <form
      action={(formData) => {
        const local = formData.get("scheduledAtLocal");
        formData.set("scheduledAt", localInputToIso(typeof local === "string" ? local : ""));
        formAction(formData);
      }}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={`${idPrefix}-kind`} label="Type" errors={errors("kind")}>
          <select
            id={`${idPrefix}-kind`}
            name="kind"
            defaultValue={state.values?.kind ?? interview?.kind ?? "PHONE"}
            className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
          >
            {InterviewKindValues.map((kind) => (
              <option key={kind} value={kind}>
                {formatInterviewKind(kind)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={`${idPrefix}-when`} label="When" errors={errors("scheduledAt")}>
          <Input
            key={isClient ? "client" : "server"}
            id={`${idPrefix}-when`}
            name="scheduledAtLocal"
            type="datetime-local"
            defaultValue={state.values?.scheduledAtLocal ?? storedLocal}
            required
          />
        </FormField>
      </div>
      <FormField id={`${idPrefix}-notes`} label="Notes" errors={errors("notes")}>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          defaultValue={state.values?.notes ?? interview?.notes ?? ""}
          className="min-h-16"
        />
      </FormField>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
