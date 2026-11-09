import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Interview } from "@job-tracker/types";
import { InterviewList } from "./interview-list";

function interview(overrides: Partial<Interview>): Interview {
  return {
    id: "int-1",
    kind: "PHONE",
    scheduledAt: "2026-11-12T11:00:00.000Z",
    notes: null,
    createdAt: "2026-11-09T10:00:00.000Z",
    updatedAt: "2026-11-09T10:00:00.000Z",
    ...overrides,
  };
}

const actions = {
  createAction: vi.fn(),
  updateAction: () => vi.fn(),
  cancelAction: () => vi.fn(),
};

describe("InterviewList", () => {
  it("splits interviews into upcoming (soonest first) and past (latest first)", () => {
    render(
      <InterviewList
        interviews={[
          interview({ id: "a", kind: "PHONE", scheduledAt: "2026-11-01T10:00:00.000Z" }),
          interview({ id: "b", kind: "TECHNICAL", scheduledAt: "2026-11-05T10:00:00.000Z", notes: "Bring laptop" }),
          interview({ id: "c", kind: "ONSITE", scheduledAt: "2026-11-12T10:00:00.000Z" }),
          interview({ id: "d", kind: "OTHER", scheduledAt: "2026-11-20T10:00:00.000Z" }),
        ]}
        now={new Date("2026-11-09T12:00:00.000Z")}
        {...actions}
      />,
    );

    const kinds = (name: string) =>
      within(screen.getByRole("list", { name }))
        .getAllByRole("listitem")
        .map((item) => item.querySelector(".font-medium")?.textContent);
    expect(kinds("Upcoming interviews")).toEqual(["Onsite", "Other"]);
    expect(kinds("Past interviews")).toEqual(["Technical", "Phone"]);
    expect(screen.getByText("Bring laptop", { selector: "p" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Cancel interview" })).toHaveLength(4);
  });

  it("shows an empty state but still offers to schedule one", () => {
    render(<InterviewList interviews={[]} now={new Date()} {...actions} />);

    expect(screen.getByText("No interviews scheduled.")).toBeTruthy();
    expect(screen.getByText("Schedule an interview")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
