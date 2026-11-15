import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CsvImportState } from "@/lib/csv-import";
import { CsvImportForm } from "./csv-import-form";

async function submitWith(state: CsvImportState) {
  const action = vi.fn(async () => state);
  const { container } = render(<CsvImportForm action={action} />);
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
  });
  expect(action).toHaveBeenCalledTimes(1);
}

describe("CsvImportForm", () => {
  it("shows the import summary on success", async () => {
    await submitWith({ result: { imported: 3, skippedDuplicates: 1 } });

    expect(screen.getByRole("status").textContent).toContain("3 applications imported, 1 duplicate skipped.");
    expect(screen.getByRole("link", { name: "Back to applications" }).getAttribute("href")).toBe("/applications");
  });

  it("lists row errors, leaving out the row number for file-level problems", async () => {
    await submitWith({
      error: "Nothing was imported. Fix these rows and upload the file again.",
      rowErrors: [
        { row: 0, messages: ["The file has no applications"] },
        { row: 4, messages: ["position: Required", "url: Invalid url"] },
      ],
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Nothing was imported.");
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["The file has no applications", "Row 4: position: Required; url: Invalid url"]);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
