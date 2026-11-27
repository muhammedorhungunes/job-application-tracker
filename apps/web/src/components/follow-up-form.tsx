"use client";

import { useActionState } from "react";
import type { Contact, FollowUp } from "@job-tracker/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialFormState, type FormState } from "@/lib/form-state";

export function FollowUpForm({
  action,
  followUp,
  contacts,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  followUp?: FollowUp;
  /** The application's contacts, for the "with" picker. */
  contacts: Pick<Contact, "id" | "name">[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const idPrefix = followUp ? `follow-up-${followUp.id}` : "follow-up-new";
  const errors = (key: string): string[] | undefined => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={`${idPrefix}-due`} label="Due on" errors={errors("dueDate")}>
          <Input
            id={`${idPrefix}-due`}
            name="dueDate"
            type="date"
            defaultValue={state.values?.dueDate ?? followUp?.dueDate ?? ""}
            required
          />
        </FormField>
        <FormField id={`${idPrefix}-contact`} label="With" errors={errors("contactId")}>
          <select
            id={`${idPrefix}-contact`}
            name="contactId"
            defaultValue={state.values?.contactId ?? followUp?.contact?.id ?? ""}
            className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
          >
            <option value="">No contact</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField id={`${idPrefix}-note`} label="What to do" errors={errors("note")}>
        <Input
          id={`${idPrefix}-note`}
          name="note"
          defaultValue={state.values?.note ?? followUp?.note ?? ""}
          placeholder="E-mail the recruiter again"
          required
        />
      </FormField>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
