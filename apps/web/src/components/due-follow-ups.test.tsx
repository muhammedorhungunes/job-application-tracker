import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DueFollowUp } from "@job-tracker/types";
import { DueFollowUps } from "./due-follow-ups";

const dueFollowUp = (id: string, company: string, overrides: Partial<DueFollowUp> = {}): DueFollowUp => ({
  id,
  dueDate: "2026-12-01",
  note: "Ping recruiter",
  contact: null,
  doneAt: null,
  createdAt: "2026-11-27T10:00:00.000Z",
  updatedAt: "2026-11-27T10:00:00.000Z",
  application: { id: `app-${id}`, position: "Engineer", status: "APPLIED", company: { id: `co-${id}`, name: company } },
  ...overrides,
});

describe("DueFollowUps", () => {
  it("lists each due follow-up linking to its application", () => {
    render(
      <DueFollowUps
        followUps={[
          dueFollowUp("1", "Acme", { contact: { id: "c", name: "Jane" } }),
          dueFollowUp("2", "Globex", { dueDate: "2026-12-03" }),
        ]}
      />,
    );

    const list = screen.getByRole("list", { name: "Follow-ups due" });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Ping recruiter · Acme — Engineer (with Jane)",
      "Ping recruiter · Globex — Engineer",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/applications/app-1", "/applications/app-2"]);
    expect(within(list).getByText("Due Dec 1, 2026")).toBeTruthy();
  });

  it("renders nothing when nothing is due", () => {
    const { container } = render(<DueFollowUps followUps={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
