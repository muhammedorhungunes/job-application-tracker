import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  CreateInterviewInputSchema,
  UpdateInterviewInputSchema,
  type CreateInterviewInput,
  type Interview,
  type UpdateInterviewInput,
} from "@job-tracker/types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import type { AccessTokenPayload } from "../auth/auth.types";
import { InterviewsService } from "./interviews.service";

// Pipes are bound to @Body() rather than the method — see ApplicationsController.create.
@Controller("applications/:applicationId/interviews")
@UseGuards(AccessTokenGuard)
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get()
  async list(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Interview[]> {
    return this.interviewsService.list(user.sub, applicationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("applicationId") applicationId: string,
    @Body(new ZodValidationPipe(CreateInterviewInputSchema)) body: CreateInterviewInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Interview> {
    return this.interviewsService.create(user.sub, applicationId, body);
  }

  @Patch(":interviewId")
  async update(
    @Param("applicationId") applicationId: string,
    @Param("interviewId") interviewId: string,
    @Body(new ZodValidationPipe(UpdateInterviewInputSchema)) body: UpdateInterviewInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Interview> {
    return this.interviewsService.update(user.sub, applicationId, interviewId, body);
  }

  @Delete(":interviewId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @Param("applicationId") applicationId: string,
    @Param("interviewId") interviewId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<void> {
    await this.interviewsService.cancel(user.sub, applicationId, interviewId);
  }
}
