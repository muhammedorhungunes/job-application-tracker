import { isValidTimeZone } from "@job-tracker/types";

/** The per-user override columns on User; null means "use the env default". */
export interface ReminderOverrides {
  timeZone: string | null;
  staleDays: number | null;
}

export interface ReminderDefaults {
  timeZone: string;
  staleDays: number;
}

/**
 * A stored zone was valid when saved, but tz data can drop or rename zones;
 * falling back keeps one bad row from failing a scan that covers every user.
 */
export function effectiveTimeZone(timeZone: string | null, fallback: string): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : fallback;
}

/**
 * The one rule for resolving a user's reminder settings, shared by the
 * reminder jobs and the stats stale count.
 */
export function effectiveReminderSettings(user: ReminderOverrides, defaults: ReminderDefaults): ReminderDefaults {
  return {
    timeZone: effectiveTimeZone(user.timeZone, defaults.timeZone),
    staleDays: user.staleDays ?? defaults.staleDays,
  };
}
