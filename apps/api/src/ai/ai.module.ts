import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { anthropicClientProvider } from "./ai.client";
import { JOB_POSTING_QUEUE } from "./ai.constants";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { JobPostingParsesRepository } from "./job-posting-parses.repository";
import { JobPostingParsesService } from "./job-posting-parses.service";
import { JobPostingProcessor } from "./job-posting.processor";

@Module({
  imports: [AuthModule, BullModule.registerQueue({ name: JOB_POSTING_QUEUE })],
  controllers: [AiController],
  providers: [anthropicClientProvider, AiService, JobPostingParsesRepository, JobPostingParsesService, JobPostingProcessor],
})
export class AiModule {}
