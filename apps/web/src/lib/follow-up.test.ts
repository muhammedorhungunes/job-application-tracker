import { describe, expect, it } from "vitest";
import { parseCreateFollowUpForm, parseUpdateFollowUpForm } from "./follow-up";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("parseCreateFollowUpForm", () => {
  it("trims the note and leaves out an empty contact", () => {
    const parsed = parseCreateFollowUpForm(formData({ dueDate: "2026-12-03", note: " Ping Jane ", contactId: "" }));

    expect(parsed.success && parsed.data).toEqual({ dueDate: "2026-12-03", note: "Ping Jane" });
  });

  it("keeps a chosen contact", () => {
    const parsed = parseCreateFollowUpForm(formData({ dueDate: "2026-12-03", note: "Ping", contactId: "con-1" }));

    expect(parsed.success && parsed.data).toEqual({ dueDate: "2026-12-03", note: "Ping", contactId: "con-1" });
  });

  it("requires a real day and a note", () => {
    const parsed = parseCreateFollowUpForm(formData({ dueDate: "2026-02-31", note: "  " }));

    expect(parsed.success).toBe(false);
    expect(Object.keys(parsed.error!.flatten().fieldErrors).sort()).toEqual(["dueDate", "note"]);
  });
});

describe("parseUpdateFollowUpForm", () => {
  it("clears the contact when none is chosen", () => {
    const parsed = parseUpdateFollowUpForm(formData({ dueDate: "2026-12-05", note: "Ping", contactId: "" }));

    expect(parsed.success && parsed.data).toEqual({ dueDate: "2026-12-05", note: "Ping", contactId: null });
  });
});
