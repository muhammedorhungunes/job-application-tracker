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
 * The one rule for resolving a user's reminder settings, shared by the
 * settings endpoint, the reminder jobs and the stats stale count.
 */
export function effectiveReminderSettings(user: ReminderOverrides, defaults: ReminderDefaults): ReminderDefaults {
  return {
    timeZone: user.timeZone ?? defaults.timeZone,
    staleDays: user.staleDays ?? defaults.staleDays,
  };
}
