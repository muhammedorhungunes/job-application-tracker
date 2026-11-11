import { Injectable, NotFoundException } from "@nestjs/common";
import type { UpdateUserSettingsInput, UserSettings } from "@job-tracker/types";
import { AppConfigService } from "../config/app-config.service";
import { SettingsRepository, type SettingsRow } from "./settings.repository";

@Injectable()
export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly config: AppConfigService,
  ) {}

  async get(userId: string): Promise<UserSettings> {
    const row = await this.repository.findByUserId(userId);
    if (!row) {
      throw new NotFoundException("User not found");
    }
    return this.toSettings(row);
  }

  async update(userId: string, input: UpdateUserSettingsInput): Promise<UserSettings> {
    // Checked first so a deleted user gets a 404 rather than Prisma's "record not found".
    await this.get(userId);
    // Zod drops absent keys, so `input` only holds fields to change; null clears an override.
    const row = await this.repository.update(userId, input);
    return this.toSettings(row);
  }

  private toSettings(row: SettingsRow): UserSettings {
    return {
      ...row,
      defaults: { timeZone: this.config.reminderTz, staleDays: this.config.reminderStaleDays },
    };
  }
}
