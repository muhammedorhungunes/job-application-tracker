import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  CreateFollowUpInputSchema,
  UpdateFollowUpInputSchema,
  type CreateFollowUpInput,
  type FollowUp,
  type UpdateFollowUpInput,
} from "@job-tracker/types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import type { AccessTokenPayload } from "../auth/auth.types";
import { FollowUpsService } from "./follow-ups.service";

// Pipes are bound to @Body() rather than the method — see ApplicationsController.create.
@Controller("applications/:applicationId/follow-ups")
@UseGuards(AccessTokenGuard)
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Get()
  async list(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<FollowUp[]> {
    return this.followUpsService.list(user.sub, applicationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("applicationId") applicationId: string,
    @Body(new ZodValidationPipe(CreateFollowUpInputSchema)) body: CreateFollowUpInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<FollowUp> {
    return this.followUpsService.create(user.sub, applicationId, body);
  }

  @Patch(":followUpId")
  async update(
    @Param("applicationId") applicationId: string,
    @Param("followUpId") followUpId: string,
    @Body(new ZodValidationPipe(UpdateFollowUpInputSchema)) body: UpdateFollowUpInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<FollowUp> {
    return this.followUpsService.update(user.sub, applicationId, followUpId, body);
  }

  @Post(":followUpId/done")
  @HttpCode(HttpStatus.OK)
  async done(
    @Param("applicationId") applicationId: string,
    @Param("followUpId") followUpId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<FollowUp> {
    return this.followUpsService.markDone(user.sub, applicationId, followUpId, new Date());
  }

  @Delete(":followUpId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("applicationId") applicationId: string,
    @Param("followUpId") followUpId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<void> {
    await this.followUpsService.delete(user.sub, applicationId, followUpId);
  }
}
