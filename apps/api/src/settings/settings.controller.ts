import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { UpdateUserSettingsInputSchema, type UpdateUserSettingsInput, type UserSettings } from "@job-tracker/types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import type { AccessTokenPayload } from "../auth/auth.types";
import { SettingsService } from "./settings.service";

// Pipes are bound to @Body() rather than the method — see ApplicationsController.create.
@Controller("settings")
@UseGuards(AccessTokenGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async get(@CurrentUser() user: AccessTokenPayload): Promise<UserSettings> {
    return this.settingsService.get(user.sub);
  }

  @Patch()
  async update(
    @Body(new ZodValidationPipe(UpdateUserSettingsInputSchema)) body: UpdateUserSettingsInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<UserSettings> {
    return this.settingsService.update(user.sub, body);
  }
}
