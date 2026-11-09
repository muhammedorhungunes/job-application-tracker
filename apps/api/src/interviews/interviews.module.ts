import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InterviewsController } from "./interviews.controller";
import { InterviewsRepository } from "./interviews.repository";
import { InterviewsService } from "./interviews.service";
import { UpcomingInterviewsController } from "./upcoming-interviews.controller";

@Module({
  // For AccessTokenGuard, same as ApplicationsModule.
  imports: [AuthModule],
  controllers: [InterviewsController, UpcomingInterviewsController],
  providers: [InterviewsService, InterviewsRepository],
})
export class InterviewsModule {}
