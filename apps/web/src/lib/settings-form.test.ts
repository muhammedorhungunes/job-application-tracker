import { describe, expect, it } from "vitest";
import { parseSettingsForm, timeZoneOptions } from "./settings-form";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("parseSettingsForm", () => {
  it("sends every setting, mapping checkboxes to booleans", () => {
    const parsed = parseSettingsForm(
      form({ name: " Ada ", timeZone: "Asia/Tokyo", staleDigestEnabled: "on", staleDays: "14" }),
    );

    expect(parsed.success && parsed.data).toEqual({
      name: "Ada",
      timeZone: "Asia/Tokyo",
      staleDigestEnabled: true,
      staleDays: 14,
      interviewRemindersEnabled: false,
    });
  });

  it("turns empty time zone and days into null (use the default)", () => {
    const parsed = parseSettingsForm(form({ name: "Ada", timeZone: "", staleDays: "" }));

    expect(parsed.success && parsed.data).toMatchObject({ timeZone: null, staleDays: null });
  });

  it("reports invalid fields", () => {
    const parsed = parseSettingsForm(form({ name: "", timeZone: "Mars/Olympus", staleDays: "abc" }));

    expect(parsed.success).toBe(false);
    expect(Object.keys(parsed.error!.flatten().fieldErrors).sort()).toEqual(["name", "staleDays", "timeZone"]);
  });

  it("rejects days outside 1-90", () => {
    expect(parseSettingsForm(form({ name: "Ada", staleDays: "0" })).success).toBe(false);
    expect(parseSettingsForm(form({ name: "Ada", staleDays: "91" })).success).toBe(false);
  });
});

describe("timeZoneOptions", () => {
  it("adds UTC and a stored zone missing from the list, sorted", () => {
    expect(timeZoneOptions("Etc/GMT+3", ["Europe/Istanbul", "Asia/Tokyo"])).toEqual([
      "Asia/Tokyo",
      "Etc/GMT+3",
      "Europe/Istanbul",
      "UTC",
    ]);
  });

  it("doesn't duplicate zones already listed", () => {
    expect(timeZoneOptions("Asia/Tokyo", ["Asia/Tokyo", "UTC"])).toEqual(["Asia/Tokyo", "UTC"]);
  });
});
