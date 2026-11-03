import { Test } from "@nestjs/testing";
import type { JobPostingParse } from "@prisma/client";
import type { Job } from "bullmq";
import { PARSE_FAILED_MESSAGE, type ExtractJobPostingJobData } from "./ai.constants";
import { AiService } from "./ai.service";
import { JobPostingParsesRepository } from "./job-posting-parses.repository";
import { JobPostingProcessor } from "./job-posting.processor";

describe("JobPostingProcessor", () => {
  let processor: JobPostingProcessor;
  let aiService: jest.Mocked<AiService>;
  let repository: jest.Mocked<JobPostingParsesRepository>;

  const row = { id: "parse-1", rawText: "posting" } as JobPostingParse;
  const extraction = { companyName: "Acme", position: "Engineer", techStack: [], location: null, url: null };

  const fakeJob = (attemptsMade: number): Job<ExtractJobPostingJobData> =>
    ({ data: { parseId: "parse-1" }, attemptsMade, opts: { attempts: 3 } }) as Job<ExtractJobPostingJobData>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JobPostingProcessor,
        { provide: AiService, useValue: { extractJobPosting: jest.fn() } },
        {
          provide: JobPostingParsesRepository,
          useValue: { findById: jest.fn(), markCompleted: jest.fn(), markFailed: jest.fn() },
        },
      ],
    }).compile();
    processor = module.get(JobPostingProcessor);
    aiService = module.get(AiService);
    repository = module.get(JobPostingParsesRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it("stores the extraction and token usage on success", async () => {
    repository.findById.mockResolvedValue(row);
    aiService.extractJobPosting.mockResolvedValue({
      data: extraction,
      model: "claude-opus-5-5",
      inputTokens: 100,
      outputTokens: 20,
    });

    await processor.process(fakeJob(0));

    expect(aiService.extractJobPosting).toHaveBeenCalledWith("posting");
    expect(repository.markCompleted).toHaveBeenCalledWith("parse-1", {
      result: extraction,
      model: "claude-opus-5-5",
      inputTokens: 100,
      outputTokens: 20,
    });
  });

  it("rethrows without marking failed when retries remain", async () => {
    repository.findById.mockResolvedValue(row);
    aiService.extractJobPosting.mockRejectedValue(new Error("bad output"));

    await expect(processor.process(fakeJob(0))).rejects.toThrow("bad output");
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("marks the parse failed with the generic message on the last attempt", async () => {
    repository.findById.mockResolvedValue(row);
    aiService.extractJobPosting.mockRejectedValue(new Error("bad output"));

    await expect(processor.process(fakeJob(2))).rejects.toThrow("bad output");
    expect(repository.markFailed).toHaveBeenCalledWith("parse-1", PARSE_FAILED_MESSAGE);
  });

  it("skips quietly when the parse row no longer exists", async () => {
    repository.findById.mockResolvedValue(null);

    await processor.process(fakeJob(0));

    expect(aiService.extractJobPosting).not.toHaveBeenCalled();
  });
});
