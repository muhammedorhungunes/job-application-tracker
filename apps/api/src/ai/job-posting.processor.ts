import Anthropic from "@anthropic-ai/sdk";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { UnrecoverableError, type Job } from "bullmq";
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
      const retryable = isRetryable(error);
      if (isLastAttempt || !retryable) {
        await this.repository.markFailed(parseId, PARSE_FAILED_MESSAGE);
      }
      // UnrecoverableError tells BullMQ to skip the remaining attempts.
      throw retryable ? error : new UnrecoverableError(error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * A 4xx from the API (bad key, invalid request, ...) fails the same way on
 * every attempt, so retrying only costs time. 408/409/429 are the exceptions.
 * Unusable model output and 5xx/network errors are worth another try.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof Anthropic.APIError && typeof error.status === "number") {
    return error.status >= 500 || [408, 409, 429].includes(error.status);
  }
  return true;
}
