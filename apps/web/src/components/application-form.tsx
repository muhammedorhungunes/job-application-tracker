"use client";

import { useActionState } from "react";
import { ApplicationStatusValues, type Application } from "@job-tracker/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { formatTechStack, isoToDateInput } from "@/lib/application-form";
import { formatStatus } from "@/lib/format";
import { initialFormState, type FormState } from "@/lib/form-state";

export function ApplicationForm({
  action,
  application,
  initialValues,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  application?: Application;
  /** Pre-filled values for a new application (e.g. extracted from a pasted posting). */
  initialValues?: Partial<Record<string, string>>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  // After a failed submit, show what the user typed rather than the stored values.
  const value = (key: string, fallback: string): string =>
    state.values?.[key] ?? initialValues?.[key] ?? fallback;
  const errors = (key: string): string[] | undefined => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex w-full max-w-xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="position" label="Position" errors={errors("position")}>
          <Input id="position" name="position" defaultValue={value("position", application?.position ?? "")} required />
        </FormField>
        <FormField id="companyName" label="Company" errors={errors("companyName")}>
          <Input
            id="companyName"
            name="companyName"
            defaultValue={value("companyName", application?.company.name ?? "")}
            required
          />
        </FormField>
        <FormField id="status" label="Status" errors={errors("status")}>
          <select
            id="status"
            name="status"
            defaultValue={value("status", application?.status ?? "APPLIED")}
            className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
          >
            {ApplicationStatusValues.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="appliedAt" label="Applied on" errors={errors("appliedAt")}>
          <Input
            id="appliedAt"
            name="appliedAt"
            type="date"
            defaultValue={value("appliedAt", isoToDateInput(application?.appliedAt ?? null))}
          />
        </FormField>
        <FormField id="source" label="Source" errors={errors("source")}>
          <Input
            id="source"
            name="source"
            placeholder="e.g. LinkedIn, referral"
            defaultValue={value("source", application?.source ?? "")}
          />
        </FormField>
        <FormField id="url" label="Job posting URL" errors={errors("url")}>
          <Input id="url" name="url" type="url" defaultValue={value("url", application?.url ?? "")} />
        </FormField>
      </div>
      <FormField id="techStack" label="Tech stack" errors={errors("techStack")}>
        <Input
          id="techStack"
          name="techStack"
          placeholder="e.g. TypeScript, PostgreSQL, AWS"
          defaultValue={value("techStack", formatTechStack(application?.techStack ?? []))}
        />
      </FormField>
      <FormField id="notes" label="Notes" errors={errors("notes")}>
        <Textarea id="notes" name="notes" defaultValue={value("notes", application?.notes ?? "")} />
      </FormField>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
