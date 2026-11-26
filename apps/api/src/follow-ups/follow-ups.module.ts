import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DueFollowUpsController } from "./due-follow-ups.controller";
import { FollowUpsController } from "./follow-ups.controller";
import { FollowUpsRepository } from "./follow-ups.repository";
import { FollowUpsService } from "./follow-ups.service";

@Module({
  // For AccessTokenGuard, same as ApplicationsModule.
  imports: [AuthModule],
  controllers: [FollowUpsController, DueFollowUpsController],
  providers: [FollowUpsService, FollowUpsRepository],
})
export class FollowUpsModule {}
