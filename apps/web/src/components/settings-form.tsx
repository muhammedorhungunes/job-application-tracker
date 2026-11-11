"use client";

import { useActionState } from "react";
import type { UserSettings } from "@job-tracker/types";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/form-state";

export function SettingsForm({
  action,
  settings,
  timeZones,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  settings: UserSettings;
  timeZones: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  // After a failed submit, show what the user typed rather than the stored values.
  const value = (key: string, stored: string): string => state.values?.[key] ?? stored;
  // An unchecked box isn't in the echoed values at all, so their presence decides.
  const checked = (key: string, stored: boolean): boolean => (state.values ? state.values[key] === "on" : stored);
  const errors = (key: string): string[] | undefined => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex w-full max-w-xl flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Profile</h2>
        <FormField id="name" label="Name" errors={errors("name")}>
          <Input id="name" name="name" maxLength={100} defaultValue={value("name", settings.name)} required />
        </FormField>
        <p className="text-sm text-muted-foreground">Signed in as {settings.email}</p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">Reminders</h2>
        <FormField id="timeZone" label="Time zone" errors={errors("timeZone")}>
          <select
            id="timeZone"
            name="timeZone"
            defaultValue={value("timeZone", settings.timeZone ?? "")}
            className="h-9 rounded-md border border-border bg-transparent px-3 text-sm"
          >
            <option value="">Default ({settings.defaults.timeZone})</option>
            {timeZones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </FormField>
        <p className="-mt-2 text-xs text-muted-foreground">
          Used for times in reminder e-mails and for when the daily digest arrives.
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="staleDigestEnabled"
            defaultChecked={checked("staleDigestEnabled", settings.staleDigestEnabled)}
          />
          E-mail me a daily digest of applications with no update
        </label>
        <FormField id="staleDays" label="Days without an update before reminding" errors={errors("staleDays")}>
          <Input
            id="staleDays"
            name="staleDays"
            type="number"
            min={1}
            max={90}
            step={1}
            placeholder={`Default (${settings.defaults.staleDays})`}
            defaultValue={value("staleDays", settings.staleDays?.toString() ?? "")}
            className="w-48"
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="interviewRemindersEnabled"
            defaultChecked={checked("interviewRemindersEnabled", settings.interviewRemindersEnabled)}
          />
          E-mail me a day before each interview
        </label>
      </section>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
