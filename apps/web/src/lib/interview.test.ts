import { describe, expect, it } from "vitest";
import {
  isoToLocalInput,
  localInputToIso,
  parseCreateInterviewForm,
  parseNoteForm,
  parseUpdateInterviewForm,
} from "./interview";

function formData(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("localInputToIso / isoToLocalInput", () => {
  it("round-trips a datetime-local value through the local time zone", () => {
    const iso = localInputToIso("2026-11-12T14:00");

    expect(iso).toBe(new Date(2026, 10, 12, 14, 0).toISOString());
    expect(isoToLocalInput(iso)).toBe("2026-11-12T14:00");
  });

  it("returns an empty string for anything that isn't a datetime-local value", () => {
    expect(localInputToIso("")).toBe("");
    expect(localInputToIso("tomorrow")).toBe("");
    expect(localInputToIso("2026-11-12")).toBe("");
  });
});

describe("parseCreateInterviewForm", () => {
  it("omits empty notes", () => {
    const parsed = parseCreateInterviewForm(
      formData({ kind: "PHONE", scheduledAt: "2026-11-12T11:00:00.000Z", notes: "  " }),
    );

    expect(parsed.success && parsed.data).toEqual({ kind: "PHONE", scheduledAt: "2026-11-12T11:00:00.000Z" });
  });

  it("rejects a missing time", () => {
    const parsed = parseCreateInterviewForm(formData({ kind: "PHONE", scheduledAt: "" }));

    expect(parsed.success).toBe(false);
  });
});

describe("parseUpdateInterviewForm", () => {
  it("sends every field and turns empty notes into null to clear them", () => {
    const parsed = parseUpdateInterviewForm(
      formData({ kind: "ONSITE", scheduledAt: "2026-11-12T11:00:00.000Z", notes: "" }),
    );

    expect(parsed.success && parsed.data).toEqual({
      kind: "ONSITE",
      scheduledAt: "2026-11-12T11:00:00.000Z",
      notes: null,
    });
  });
});

describe("parseNoteForm", () => {
  it("trims the text and rejects an empty note", () => {
    const ok = parseNoteForm(formData({ text: "  Called the recruiter " }));
    expect(ok.success && ok.data).toEqual({ text: "Called the recruiter" });

    expect(parseNoteForm(formData({ text: "   " })).success).toBe(false);
  });
});
