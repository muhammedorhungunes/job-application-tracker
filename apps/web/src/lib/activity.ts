import type { Activity } from "@job-tracker/types";
import { formatStatus } from "./format";

/** Short timeline label built from the structured fields; falls back to the stored description. */
export function activityLabel(activity: Activity): string {
  switch (activity.type) {
    case "APPLICATION_CREATED":
      // Backfilled creation rows don't know their initial status.
      return activity.toStatus ? `Added as ${formatStatus(activity.toStatus)}` : "Added";
    case "STATUS_CHANGE":
      if (activity.fromStatus && activity.toStatus) {
        return `${formatStatus(activity.fromStatus)} → ${formatStatus(activity.toStatus)}`;
      }
      return activity.description;
    default:
      return activity.description;
  }
}
