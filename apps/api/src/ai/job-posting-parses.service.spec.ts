import { getQueueToken } from "@nestjs/bullmq";
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { JobPostingParse } from "@prisma/client";
import { EXTRACT_JOB_POSTING_JOB, JOB_POSTING_QUEUE, PARSE_FAILED_MESSAGE } from "./ai.constants";
import { JobPostingParsesRepository } from "./job-posting-parses.repository";
import { JobPostingParsesService } from "./job-posting-parses.service";

describe("JobPostingParsesService", () => {
  let service: JobPostingParsesService;
  let repository: jest.Mocked<JobPostingParsesRepository>;
  const queue = { add: jest.fn() };

  const pendingRow: JobPostingParse = {
    id: "parse-1",
    userId: "user-1",
    rawText: "posting",
    status: "PENDING",
    result: null,
    errorMessage: null,
    model: null,
    inputTokens: null,
    outputTokens: null,
    createdAt: new Date("2026-11-04T10:00:00.000Z"),
    updatedAt: new Date("2026-11-04T10:00:00.000Z"),
    deletedAt: null,
  };

  const extraction = {
    companyName: "Acme Inc",
    position: "Backend Engineer",
    techStack: ["TypeScript"],
    location: null,
    url: null,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JobPostingParsesService,
        { provide: JobPostingParsesRepository, useValue: { create: jest.fn(), findByIdForUser: jest.fn() } },
        { provide: getQueueToken(JOB_POSTING_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(JobPostingParsesService);
    repository = module.get(JobPostingParsesRepository);
  });

  afterEach(() => jest.clearAllMocks());

  describe("requestParse", () => {
    it("stores the posting for the user and queues an extract job with retries", async () => {
      repository.create.mockResolvedValue(pendingRow);

      const result = await service.requestParse("user-1", "posting");

      expect(repository.create).toHaveBeenCalledWith("user-1", "posting");
      expect(queue.add).toHaveBeenCalledWith(
        EXTRACT_JOB_POSTING_JOB,
        { parseId: "parse-1" },
        expect.objectContaining({ attempts: 3 }),
      );
      expect(result).toEqual({
        id: "parse-1",
        status: "PENDING",
        result: null,
        errorMessage: null,
        createdAt: "2026-11-04T10:00:00.000Z",
      });
    });
  });

  describe("getForUser", () => {
    it("looks the parse up scoped to the user", async () => {
      repository.findByIdForUser.mockResolvedValue(pendingRow);

      await service.getForUser("user-1", "parse-1");

      expect(repository.findByIdForUser).toHaveBeenCalledWith("parse-1", "user-1");
    });

    it("throws NotFoundException when the parse doesn't exist or isn't the user's", async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(service.getForUser("user-1", "missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the stored result when completed", async () => {
      repository.findByIdForUser.mockResolvedValue({ ...pendingRow, status: "COMPLETED", result: extraction });

      const result = await service.getForUser("user-1", "parse-1");

      expect(result.status).toBe("COMPLETED");
      expect(result.result).toEqual(extraction);
    });

    it("reports FAILED instead of leaking a stored result that fails the schema", async () => {
      repository.findByIdForUser.mockResolvedValue({ ...pendingRow, status: "COMPLETED", result: { junk: true } });

      const result = await service.getForUser("user-1", "parse-1");

      expect(result).toEqual(expect.objectContaining({ status: "FAILED", result: null, errorMessage: PARSE_FAILED_MESSAGE }));
    });
  });
});
