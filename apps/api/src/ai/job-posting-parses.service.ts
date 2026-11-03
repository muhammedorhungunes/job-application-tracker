import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { JobPostingParse as JobPostingParseRow } from "@prisma/client";
import { JobPostingExtractionSchema, type JobPostingParse } from "@job-tracker/types";
import type { Queue } from "bullmq";
import {
  EXTRACT_JOB_POSTING_JOB,
  JOB_POSTING_QUEUE,
  PARSE_FAILED_MESSAGE,
  type ExtractJobPostingJobData,
} from "./ai.constants";
import { JobPostingParsesRepository } from "./job-posting-parses.repository";

@Injectable()
export class JobPostingParsesService {
  private readonly logger = new Logger(JobPostingParsesService.name);

  constructor(
    private readonly repository: JobPostingParsesRepository,
    @InjectQueue(JOB_POSTING_QUEUE) private readonly queue: Queue<ExtractJobPostingJobData>,
  ) {}

  /** Stores the posting and queues the Claude call; the request itself never waits on the AI. */
  async requestParse(userId: string, text: string): Promise<JobPostingParse> {
    const row = await this.repository.create(userId, text);
    await this.queue.add(
      EXTRACT_JOB_POSTING_JOB,
      { parseId: row.id },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: true, removeOnFail: 100 },
    );
    return this.toJobPostingParse(row);
  }

  async getForUser(userId: string, id: string): Promise<JobPostingParse> {
    const row = await this.repository.findByIdForUser(id, userId);
    if (!row) {
      throw new NotFoundException("Job posting parse not found");
    }
    return this.toJobPostingParse(row);
  }

  private toJobPostingParse(row: JobPostingParseRow): JobPostingParse {
    let result: JobPostingParse["result"] = null;
    let status = row.status;
    let errorMessage = row.errorMessage;

    if (row.status === "COMPLETED") {
      // The JSON column is untyped, so re-validate it on the way out.
      const parsed = JobPostingExtractionSchema.safeParse(row.result);
      if (parsed.success) {
        result = parsed.data;
      } else {
        this.logger.error(`JobPostingParse ${row.id} has a result that fails the schema`);
        status = "FAILED";
        errorMessage = PARSE_FAILED_MESSAGE;
      }
    }

    return { id: row.id, status, result, errorMessage, createdAt: row.createdAt.toISOString() };
  }
}
