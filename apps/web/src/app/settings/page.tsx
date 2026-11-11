import { UserSettingsSchema } from "@job-tracker/types";
import { SettingsForm } from "@/components/settings-form";
import { serverApiFetch } from "@/lib/session";
import { timeZoneOptions } from "@/lib/settings-form";
import { updateSettings } from "./actions";

export default async function SettingsPage() {
  const settings = await serverApiFetch("/settings", UserSettingsSchema);
  // Built on the server: the API validates zones with the same Node Intl data.
  const zones = timeZoneOptions(settings.timeZone, Intl.supportedValuesOf("timeZone"));

  return (
    <>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm action={updateSettings} settings={settings} timeZones={zones} />
    </>
  );
}
