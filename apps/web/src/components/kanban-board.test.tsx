import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Application } from "@job-tracker/types";
import { KanbanBoard } from "./kanban-board";

// The real module is a server action file that imports next/headers.
vi.mock("@/app/applications/actions", () => ({ updateApplicationStatus: vi.fn() }));

function application(overrides: Partial<Application> & Pick<Application, "id" | "position">): Application {
  return {
    status: "APPLIED",
    source: null,
    url: null,
    appliedAt: null,
    notes: null,
    techStack: [],
    location: null,
    workMode: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    company: { id: "company-1", name: "Acme Inc" },
    ...overrides,
  };
}

describe("KanbanBoard", () => {
  it("renders a column per status with its cards and count", () => {
    render(
      <KanbanBoard
        applications={[
          application({ id: "a", position: "Backend Engineer" }),
          application({ id: "b", position: "Frontend Engineer", status: "OFFER" }),
        ]}
      />,
    );

    const columns = screen.getAllByRole("region");
    expect(columns.map((column) => within(column).getByRole("heading").textContent)).toEqual([
      "Applied1",
      "Interviewing0",
      "Offer1",
      "Rejected0",
      "Withdrawn0",
    ]);

    const offer = screen.getByRole("region", { name: /offer/i });
    expect(within(offer).getByRole("link", { name: /frontend engineer/i })).toHaveAttribute("href", "/applications/b");
    expect(within(offer).queryByText("Backend Engineer")).not.toBeInTheDocument();
  });

  it("shows location, work mode and salary on a card only when they're set", () => {
    render(
      <KanbanBoard
        applications={[
          application({
            id: "a",
            position: "Backend Engineer",
            location: "Berlin",
            workMode: "HYBRID",
            salaryMin: "60000.00",
            salaryMax: "75000.00",
            salaryCurrency: "EUR",
            salaryPeriod: "YEAR",
          }),
          application({ id: "b", position: "Frontend Engineer" }),
        ]}
      />,
    );

    const withDetails = screen.getByRole("link", { name: /backend engineer/i });
    expect(within(withDetails).getByText("Berlin · Hybrid")).toBeInTheDocument();
    expect(within(withDetails).getByText("€60,000–€75,000 / year")).toBeInTheDocument();

    const without = screen.getByRole("link", { name: /frontend engineer/i });
    expect(without.querySelectorAll("p")).toHaveLength(3);
  });
});
