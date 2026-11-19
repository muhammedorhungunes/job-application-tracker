import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ArchivedApplication } from "@job-tracker/types";
import { ArchivedList } from "./archived-list";

const archived: ArchivedApplication = {
  id: "app-1",
  position: "Backend Engineer",
  status: "REJECTED",
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
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-10T00:00:00.000Z",
  archivedAt: "2026-11-10T00:00:00.000Z",
  company: { id: "c-1", name: "Acme" },
};

describe("ArchivedList", () => {
  it("lists each application with company, status, archive date and a Restore button", () => {
    const restoreAction = vi.fn(() => async () => {});
    render(<ArchivedList applications={[archived]} restoreAction={restoreAction} />);

    expect(screen.getByText("Backend Engineer")).toBeTruthy();
    expect(screen.getByText(/Acme · Rejected · Archived Nov 10, 2026/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore" })).toBeTruthy();
    expect(restoreAction).toHaveBeenCalledWith("app-1");
  });

  it("shows an empty state", () => {
    render(<ArchivedList applications={[]} restoreAction={vi.fn()} />);

    expect(screen.getByText("No archived applications.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
