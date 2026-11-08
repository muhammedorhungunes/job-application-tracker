import type { Activity } from "@job-tracker/types";
import { describe, expect, it } from "vitest";
import { activityLabel } from "./activity";

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: "act-1",
    type: "STATUS_CHANGE",
    description: "stored description",
    fromStatus: null,
    toStatus: null,
    createdAt: "2026-11-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("activityLabel", () => {
  it("shows a status change as from → to", () => {
    expect(activityLabel(activity({ fromStatus: "APPLIED", toStatus: "INTERVIEWING" }))).toBe(
      "Applied → Interviewing",
    );
  });

  it("shows the initial status of a creation entry", () => {
    expect(activityLabel(activity({ type: "APPLICATION_CREATED", toStatus: "APPLIED" }))).toBe("Added as Applied");
  });

  it("shows a bare 'Added' for backfilled creation entries without a known status", () => {
    expect(activityLabel(activity({ type: "APPLICATION_CREATED" }))).toBe("Added");
  });

  it("falls back to the stored description for other types or incomplete data", () => {
    expect(activityLabel(activity({ type: "NOTE", description: "Called the recruiter" }))).toBe("Called the recruiter");
    expect(activityLabel(activity({ toStatus: "OFFER" }))).toBe("stored description");
  });
});
