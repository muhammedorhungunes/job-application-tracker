"use client";

import { useActionState } from "react";
import {
  ApplicationStatusValues,
  SalaryPeriodValues,
  WorkModeValues,
  type Application,
} from "@job-tracker/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { amountToInput, formatTechStack, isoToDateInput } from "@/lib/application-form";
import { formatStatus, formatWorkMode, SALARY_PERIOD_LABELS } from "@/lib/format";
import { initialFormState, type FormState } from "@/lib/form-state";

const selectClassName = "h-9 rounded-md border border-border bg-transparent px-3 text-sm";

/** Suggestions only: any 3-letter ISO code is accepted. */
const COMMON_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "TRY"];

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
            className={selectClassName}
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
        <FormField id="location" label="Location" errors={errors("location")}>
          <Input
            id="location"
            name="location"
            placeholder="e.g. Berlin"
            defaultValue={value("location", application?.location ?? "")}
          />
        </FormField>
        <FormField id="workMode" label="Work mode" errors={errors("workMode")}>
          <select
            id="workMode"
            name="workMode"
            defaultValue={value("workMode", application?.workMode ?? "")}
            className={selectClassName}
          >
            <option value="">Not specified</option>
            {WorkModeValues.map((mode) => (
              <option key={mode} value={mode}>
                {formatWorkMode(mode)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-medium">Salary</legend>
        <FormField id="salaryMin" label="From" errors={errors("salaryMin")}>
          <Input
            id="salaryMin"
            name="salaryMin"
            inputMode="decimal"
            placeholder="60000"
            defaultValue={value("salaryMin", amountToInput(application?.salaryMin ?? null))}
          />
        </FormField>
        <FormField id="salaryMax" label="To" errors={errors("salaryMax")}>
          <Input
            id="salaryMax"
            name="salaryMax"
            inputMode="decimal"
            placeholder="75000"
            defaultValue={value("salaryMax", amountToInput(application?.salaryMax ?? null))}
          />
        </FormField>
        <FormField id="salaryCurrency" label="Currency" errors={errors("salaryCurrency")}>
          <Input
            id="salaryCurrency"
            name="salaryCurrency"
            list="salary-currencies"
            maxLength={3}
            defaultValue={value("salaryCurrency", application?.salaryCurrency ?? "EUR")}
          />
          <datalist id="salary-currencies">
            {COMMON_CURRENCIES.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
        </FormField>
        <FormField id="salaryPeriod" label="Per" errors={errors("salaryPeriod")}>
          <select
            id="salaryPeriod"
            name="salaryPeriod"
            defaultValue={value("salaryPeriod", application?.salaryPeriod ?? "YEAR")}
            className={selectClassName}
          >
            {SalaryPeriodValues.map((period) => (
              <option key={period} value={period}>
                {SALARY_PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
        </FormField>
      </fieldset>
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
