import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { UpcomingInterview } from "@job-tracker/types";
import { UpcomingInterviews } from "./upcoming-interviews";

const interview = (id: string, company: string, kind: UpcomingInterview["kind"]): UpcomingInterview => ({
  id,
  kind,
  scheduledAt: "2026-11-12T11:00:00.000Z",
  notes: null,
  createdAt: "2026-11-09T10:00:00.000Z",
  updatedAt: "2026-11-09T10:00:00.000Z",
  application: { id: `app-${id}`, position: "Engineer", status: "INTERVIEWING", company: { id: `co-${id}`, name: company } },
});

describe("UpcomingInterviews", () => {
  it("lists interviews in order, each linking to its application", () => {
    render(
      <UpcomingInterviews days={7} interviews={[interview("1", "Acme", "TECHNICAL"), interview("2", "Globex", "PHONE")]} />,
    );

    const links = within(screen.getByRole("list", { name: "Upcoming interviews" })).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Technical · Acme — Engineer", "Phone · Globex — Engineer"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/applications/app-1", "/applications/app-2"]);
    expect(screen.getByText("Next 7 days")).toBeTruthy();
  });

  it("renders nothing when there are no upcoming interviews", () => {
    const { container } = render(<UpcomingInterviews days={7} interviews={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
