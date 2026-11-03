import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { AiService } from "./ai.service";
import { JOB_POSTING_QUEUE, PARSE_FAILED_MESSAGE, type ExtractJobPostingJobData } from "./ai.constants";
import { JobPostingParsesRepository } from "./job-posting-parses.repository";

@Processor(JOB_POSTING_QUEUE)
export class JobPostingProcessor extends WorkerHost {
  private readonly logger = new Logger(JobPostingProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly repository: JobPostingParsesRepository,
  ) {
    super();
  }

  async process(job: Job<ExtractJobPostingJobData>): Promise<void> {
    const { parseId } = job.data;
    const row = await this.repository.findById(parseId);
    if (!row) {
      // Deleted while queued; nothing to do and nothing worth retrying.
      this.logger.warn(`JobPostingParse ${parseId} not found, skipping`);
      return;
    }

    try {
      const { data, model, inputTokens, outputTokens } = await this.aiService.extractJobPosting(row.rawText);
      await this.repository.markCompleted(parseId, { result: data, model, inputTokens, outputTokens });
    } catch (error) {
      // attemptsMade counts finished attempts, so +1 is the one running now.
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      this.logger.warn(
        `JobPostingParse ${parseId} attempt ${job.attemptsMade + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (isLastAttempt) {
        await this.repository.markFailed(parseId, PARSE_FAILED_MESSAGE);
      }
      throw error;
    }
  }
}
