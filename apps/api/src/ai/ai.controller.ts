import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { ParseJobPostingInputSchema, type JobPostingParse, type ParseJobPostingInput } from "@job-tracker/types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import type { AccessTokenPayload } from "../auth/auth.types";
import { JobPostingParsesService } from "./job-posting-parses.service";

@Controller("ai/job-postings")
@UseGuards(AccessTokenGuard)
export class AiController {
  constructor(private readonly jobPostingParsesService: JobPostingParsesService) {}

  // 202: the parse runs in a queue job; the client polls GET /:id for the result.
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(
    // Pipe bound to @Body(), not the method; see ApplicationsController.create.
    @Body(new ZodValidationPipe(ParseJobPostingInputSchema)) body: ParseJobPostingInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<JobPostingParse> {
    return this.jobPostingParsesService.requestParse(user.sub, body.text);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload): Promise<JobPostingParse> {
    return this.jobPostingParsesService.getForUser(user.sub, id);
  }
}
