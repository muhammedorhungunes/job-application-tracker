import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppConfigService } from "../config/app-config.service";
import { effectiveReminderSettings } from "./effective-settings";
import { SettingsRepository, type SettingsRow } from "./settings.repository";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  let service: SettingsService;
  let repository: jest.Mocked<SettingsRepository>;

  const row: SettingsRow = {
    name: "Ada",
    email: "ada@example.com",
    timeZone: null,
    staleDigestEnabled: true,
    staleDays: null,
    interviewRemindersEnabled: true,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsRepository, useValue: { findByUserId: jest.fn(), update: jest.fn() } },
        { provide: AppConfigService, useValue: { reminderTz: "Europe/Istanbul", reminderStaleDays: 7 } },
      ],
    }).compile();
    service = module.get(SettingsService);
    repository = module.get(SettingsRepository);
  });

  describe("get", () => {
    it("returns the user's settings with the env defaults", async () => {
      repository.findByUserId.mockResolvedValue(row);

      await expect(service.get("user-1")).resolves.toEqual({
        ...row,
        defaults: { timeZone: "Europe/Istanbul", staleDays: 7 },
      });
      expect(repository.findByUserId).toHaveBeenCalledWith("user-1");
    });

    it("throws NotFoundException for an unknown or deleted user", async () => {
      repository.findByUserId.mockResolvedValue(null);
      await expect(service.get("gone")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("update", () => {
    it("writes only the given fields, including nulls that reset an override", async () => {
      repository.findByUserId.mockResolvedValue({ ...row, timeZone: "America/New_York" });
      repository.update.mockResolvedValue({ ...row, staleDigestEnabled: false });

      const result = await service.update("user-1", { timeZone: null, staleDigestEnabled: false });

      expect(repository.update).toHaveBeenCalledWith("user-1", { timeZone: null, staleDigestEnabled: false });
      expect(result.staleDigestEnabled).toBe(false);
      expect(result.defaults).toEqual({ timeZone: "Europe/Istanbul", staleDays: 7 });
    });

    it("throws NotFoundException without writing when the user is gone", async () => {
      repository.findByUserId.mockResolvedValue(null);

      await expect(service.update("gone", { name: "X" })).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});

describe("effectiveReminderSettings", () => {
  const defaults = { timeZone: "Europe/Istanbul", staleDays: 7 };

  it("falls back to the defaults for unset overrides", () => {
    expect(effectiveReminderSettings({ timeZone: null, staleDays: null }, defaults)).toEqual(defaults);
  });

  it("ignores a stored zone that Intl no longer knows", () => {
    expect(effectiveReminderSettings({ timeZone: "Gone/Zone", staleDays: null }, defaults).timeZone).toBe(
      "Europe/Istanbul",
    );
  });

  it("prefers the user's own values", () => {
    expect(effectiveReminderSettings({ timeZone: "Asia/Tokyo", staleDays: 14 }, defaults)).toEqual({
      timeZone: "Asia/Tokyo",
      staleDays: 14,
    });
  });
});
