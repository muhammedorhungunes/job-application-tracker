import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  UpcomingInterviewsQuerySchema,
  type UpcomingInterview,
  type UpcomingInterviewsQuery,
} from "@job-tracker/types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import type { AccessTokenPayload } from "../auth/auth.types";
import { InterviewsService } from "./interviews.service";

/** Cross-application view; per-application CRUD stays in InterviewsController. */
@Controller("interviews")
@UseGuards(AccessTokenGuard)
export class UpcomingInterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get("upcoming")
  async upcoming(
    @Query(new ZodValidationPipe(UpcomingInterviewsQuerySchema)) query: UpcomingInterviewsQuery,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<UpcomingInterview[]> {
    return this.interviewsService.listUpcoming(user.sub, query.days);
  }
}
