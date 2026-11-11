import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UserSettings } from "@job-tracker/types";
import { SettingsForm } from "./settings-form";

const settings: UserSettings = {
  name: "Ada",
  email: "ada@example.com",
  timeZone: null,
  staleDigestEnabled: true,
  staleDays: null,
  interviewRemindersEnabled: false,
  defaults: { timeZone: "Europe/Istanbul", staleDays: 7 },
};

const renderForm = (overrides: Partial<UserSettings> = {}) =>
  render(
    <SettingsForm action={vi.fn()} settings={{ ...settings, ...overrides }} timeZones={["Asia/Tokyo", "UTC"]} />,
  );

describe("SettingsForm", () => {
  it("prefills the stored settings and shows defaults for unset overrides", () => {
    renderForm();

    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Ada");
    expect(screen.getByText("Signed in as ada@example.com")).toBeTruthy();
    const zone = screen.getByLabelText<HTMLSelectElement>("Time zone");
    expect(zone.value).toBe("");
    expect(zone.options[0]!.textContent).toBe("Default (Europe/Istanbul)");
    const days = screen.getByLabelText<HTMLInputElement>("Days without an update before reminding");
    expect(days.value).toBe("");
    expect(days.placeholder).toBe("Default (7)");
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: /daily digest/ }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("checkbox", { name: /before each interview/ }).checked).toBe(false);
  });

  it("selects the user's own zone and threshold", () => {
    renderForm({ timeZone: "Asia/Tokyo", staleDays: 14 });

    expect(screen.getByLabelText<HTMLSelectElement>("Time zone").value).toBe("Asia/Tokyo");
    expect(screen.getByLabelText<HTMLInputElement>("Days without an update before reminding").value).toBe("14");
  });
});
