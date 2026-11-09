import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityTimeline } from "./activity-timeline";

describe("ActivityTimeline", () => {
  it("lists entries in the given order with their dates", () => {
    render(
      <ActivityTimeline
        activities={[
          {
            id: "act-2",
            type: "STATUS_CHANGE",
            description: "Status changed from Applied to Interviewing",
            fromStatus: "APPLIED",
            toStatus: "INTERVIEWING",
            createdAt: "2026-11-08T10:00:00.000Z",
          },
          {
            id: "act-1",
            type: "APPLICATION_CREATED",
            description: "Added as Applied",
            fromStatus: null,
            toStatus: "APPLIED",
            createdAt: "2026-11-01T10:00:00.000Z",
          },
        ]}
      />,
    );

    const items = within(screen.getByRole("list", { name: "Application history" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Applied → InterviewingNov 8, 2026",
      "Added as AppliedNov 1, 2026",
    ]);
  });

  it("offers delete only on notes, and only when a delete action is given", () => {
    const activities = [
      {
        id: "note-1",
        type: "NOTE" as const,
        description: "Called the recruiter",
        fromStatus: null,
        toStatus: null,
        createdAt: "2026-11-09T10:00:00.000Z",
      },
      {
        id: "act-1",
        type: "INTERVIEW_SCHEDULED" as const,
        description: "Phone interview scheduled",
        fromStatus: null,
        toStatus: null,
        createdAt: "2026-11-08T10:00:00.000Z",
      },
    ];
    const deleteNoteAction = vi.fn(() => vi.fn());

    const { unmount } = render(<ActivityTimeline activities={activities} deleteNoteAction={deleteNoteAction} />);

    expect(screen.getByText("Called the recruiter")).toBeTruthy();
    expect(screen.getByText("Phone interview scheduled")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
    expect(deleteNoteAction).toHaveBeenCalledWith("note-1");

    unmount();
    render(<ActivityTimeline activities={activities} />);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("shows an empty state when there is no history", () => {
    render(<ActivityTimeline activities={[]} />);

    expect(screen.getByText("No history yet.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
