"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState, type FormState } from "@/lib/form-state";

export function NoteForm({ action }: { action: (state: FormState, formData: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  // React resets the form after a successful action; on an error the text is echoed back.
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="note-text" className="sr-only">
        Note
      </label>
      <Textarea
        id="note-text"
        name="text"
        placeholder="Add a note, e.g. called the recruiter"
        defaultValue={state.values?.text ?? ""}
        className="min-h-16"
        required
      />
      {(state.fieldErrors?.text?.[0] ?? state.error) && (
        <p className="text-sm text-red-600">{state.fieldErrors?.text?.[0] ?? state.error}</p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding..." : "Add note"}
        </Button>
      </div>
    </form>
  );
}
