import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FollowUp } from "@job-tracker/types";
import { FollowUpList } from "./follow-up-list";

function followUp(overrides: Partial<FollowUp>): FollowUp {
  return {
    id: "fu-1",
    dueDate: "2026-12-03",
    note: "E-mail Jane again",
    contact: null,
    doneAt: null,
    createdAt: "2026-11-27T10:00:00.000Z",
    updatedAt: "2026-11-27T10:00:00.000Z",
    ...overrides,
  };
}

const actions = {
  createAction: vi.fn(),
  updateAction: () => vi.fn(),
  doneAction: () => vi.fn(),
  deleteAction: () => vi.fn(),
};

describe("FollowUpList", () => {
  it("marks due ones, shows later and done ones, and only offers Done on open ones", () => {
    render(
      <FollowUpList
        followUps={[
          followUp({ id: "due", note: "Ping Jane", contact: { id: "con-1", name: "Jane Doe" } }),
          followUp({ id: "later", note: "Ask for feedback", dueDate: "2026-12-10" }),
          followUp({ id: "done", note: "Thank-you mail", doneAt: "2026-11-25T09:00:00.000Z" }),
        ]}
        dueIds={new Set(["due"])}
        contacts={[{ id: "con-1", name: "Jane Doe" }]}
        {...actions}
      />,
    );

    const items = within(screen.getByRole("list", { name: "Follow-ups" })).getAllByRole("listitem");
    const [due, later, done] = items.map((item) => within(item));

    expect(due!.getByText("Due Dec 3, 2026").className).toContain("text-red-600");
    expect(due!.getByText("With Jane Doe")).toBeTruthy();
    expect(later!.getByText("On Dec 10, 2026")).toBeTruthy();
    expect(done!.getByText("Thank-you mail").className).toContain("line-through");
    expect(done!.getByText("Done Nov 25, 2026")).toBeTruthy();

    expect(due!.getByRole("button", { name: "Done" })).toBeTruthy();
    expect(done!.queryByRole("button", { name: "Done" })).toBeNull();
    expect(done!.queryByText("Edit")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(3);
  });

  it("offers the application's contacts in the form", () => {
    render(<FollowUpList followUps={[]} dueIds={new Set()} contacts={[{ id: "con-1", name: "Jane Doe" }]} {...actions} />);

    expect(screen.getByText("No follow-ups planned.")).toBeTruthy();
    const select = screen.getByLabelText<HTMLSelectElement>("With");
    expect([...select.options].map((option) => option.textContent)).toEqual(["No contact", "Jane Doe"]);
  });
});
