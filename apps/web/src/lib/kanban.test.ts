import { describe, expect, it } from "vitest";
import { ApplicationStatusValues, type Application } from "@job-tracker/types";
import { groupByStatus, moveApplication } from "./kanban";

function application(overrides: Partial<Application> & Pick<Application, "id">): Application {
  return {
    position: "Backend Engineer",
    status: "APPLIED",
    source: null,
    url: null,
    appliedAt: null,
    notes: null,
    techStack: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    company: { id: "company-1", name: "Acme Inc" },
    ...overrides,
  };
}

describe("groupByStatus", () => {
  it("returns every status as a column in enum order, even when empty", () => {
    const columns = groupByStatus([]);

    expect(Object.keys(columns)).toEqual([...ApplicationStatusValues]);
    for (const status of ApplicationStatusValues) expect(columns[status]).toEqual([]);
  });

  it("puts each application in its status column, most recently updated first", () => {
    const older = application({ id: "a", updatedAt: "2026-09-01T00:00:00.000Z" });
    const newer = application({ id: "b", updatedAt: "2026-09-05T00:00:00.000Z" });
    const offer = application({ id: "c", status: "OFFER" });

    const columns = groupByStatus([older, offer, newer]);

    expect(columns.APPLIED.map((a) => a.id)).toEqual(["b", "a"]);
    expect(columns.OFFER.map((a) => a.id)).toEqual(["c"]);
    expect(columns.INTERVIEWING).toEqual([]);
  });
});

describe("moveApplication", () => {
  const now = "2026-11-01T12:00:00.000Z";

  it("changes the status and bumps updatedAt of the moved application only", () => {
    const moved = application({ id: "a" });
    const other = application({ id: "b" });

    const result = moveApplication([moved, other], "a", "INTERVIEWING", now);

    expect(result[0]).toEqual({ ...moved, status: "INTERVIEWING", updatedAt: now });
    expect(result[1]).toBe(other);
  });

  it("leaves the application untouched when dropped on its own column", () => {
    const same = application({ id: "a" });

    expect(moveApplication([same], "a", "APPLIED", now)[0]).toBe(same);
  });

  it("ignores an unknown id", () => {
    const apps = [application({ id: "a" })];

    expect(moveApplication(apps, "missing", "OFFER", now)).toEqual(apps);
  });
});
