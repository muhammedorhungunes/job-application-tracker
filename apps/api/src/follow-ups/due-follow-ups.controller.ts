import { Controller, Get, UseGuards } from "@nestjs/common";
import type { DueFollowUp } from "@job-tracker/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import type { AccessTokenPayload } from "../auth/auth.types";
import { FollowUpsService } from "./follow-ups.service";

/** Cross-application view; per-application CRUD stays in FollowUpsController. */
@Controller("follow-ups")
@UseGuards(AccessTokenGuard)
export class DueFollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Get("due")
  async due(@CurrentUser() user: AccessTokenPayload): Promise<DueFollowUp[]> {
    return this.followUpsService.listDue(user.sub, new Date());
  }
}
