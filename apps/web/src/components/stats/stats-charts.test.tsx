import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBarChart } from "./status-bar-chart";
import { WeeklyChart } from "./weekly-chart";

describe("StatusBarChart", () => {
  it("lists every status with its count and sizes bars against the largest", () => {
    render(<StatusBarChart byStatus={{ APPLIED: 4, INTERVIEWING: 2, OFFER: 0, REJECTED: 1, WITHDRAWN: 0 }} />);

    const items = within(screen.getByRole("list", { name: "Applications by status" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Applied4",
      "Interviewing2",
      "Offer0",
      "Rejected1",
      "Withdrawn0",
    ]);
    expect(screen.getByTestId("status-bar-APPLIED").style.width).toBe("100%");
    expect(screen.getByTestId("status-bar-INTERVIEWING").style.width).toBe("50%");
    // Zero draws no bar at all, not a sliver.
    expect(screen.queryByTestId("status-bar-OFFER")).toBeNull();
  });
});

describe("WeeklyChart", () => {
  const weekly = [
    { weekStart: "2026-10-19", count: 1 },
    { weekStart: "2026-10-26", count: 0 },
    { weekStart: "2026-11-02", count: 2 },
  ];

  it("draws a column per non-empty week, scaled to the busiest week", () => {
    render(<WeeklyChart weekly={weekly} />);

    const columns = screen.getAllByTestId("weekly-column");
    expect(columns.map((c) => c.style.height)).toEqual(["50%", "100%"]);
  });

  it("exposes every week's value in an accessible table", () => {
    render(<WeeklyChart weekly={weekly} />);

    const table = screen.getByRole("table", { name: "Applications per week" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(["Oct 191", "Oct 260", "Nov 22"]);
  });
});
