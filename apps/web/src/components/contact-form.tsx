"use client";

import { useActionState } from "react";
import type { Contact } from "@job-tracker/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { initialFormState, type FormState } from "@/lib/form-state";

export function ContactForm({
  action,
  contact,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  contact?: Contact;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const idPrefix = contact ? `contact-${contact.id}` : "contact-new";
  const errors = (key: string): string[] | undefined => state.fieldErrors?.[key];
  const value = (key: keyof Contact): string => state.values?.[key] ?? contact?.[key] ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={`${idPrefix}-name`} label="Name" errors={errors("name")}>
          <Input id={`${idPrefix}-name`} name="name" defaultValue={value("name")} required />
        </FormField>
        <FormField id={`${idPrefix}-role`} label="Role" errors={errors("role")}>
          <Input id={`${idPrefix}-role`} name="role" defaultValue={value("role")} placeholder="Recruiter" />
        </FormField>
        <FormField id={`${idPrefix}-email`} label="E-mail" errors={errors("email")}>
          <Input id={`${idPrefix}-email`} name="email" type="email" defaultValue={value("email")} />
        </FormField>
        <FormField id={`${idPrefix}-phone`} label="Phone" errors={errors("phone")}>
          <Input id={`${idPrefix}-phone`} name="phone" type="tel" defaultValue={value("phone")} />
        </FormField>
      </div>
      <FormField id={`${idPrefix}-linkedin`} label="LinkedIn" errors={errors("linkedinUrl")}>
        <Input
          id={`${idPrefix}-linkedin`}
          name="linkedinUrl"
          type="url"
          defaultValue={value("linkedinUrl")}
          placeholder="https://www.linkedin.com/in/..."
        />
      </FormField>
      <FormField id={`${idPrefix}-notes`} label="Notes" errors={errors("notes")}>
        <Textarea id={`${idPrefix}-notes`} name="notes" defaultValue={value("notes")} className="min-h-16" />
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
