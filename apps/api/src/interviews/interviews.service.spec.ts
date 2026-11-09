import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { InterviewsRepository, type InterviewRow } from "./interviews.repository";
import { InterviewsService } from "./interviews.service";

describe("InterviewsService", () => {
  let service: InterviewsService;
  let repository: jest.Mocked<InterviewsRepository>;

  const row: InterviewRow = {
    id: "int-1",
    kind: "TECHNICAL",
    scheduledAt: new Date("2026-11-12T11:00:00.000Z"),
    notes: null,
    createdAt: new Date("2026-11-09T10:00:00.000Z"),
    updatedAt: new Date("2026-11-09T10:00:00.000Z"),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InterviewsService,
        {
          provide: InterviewsRepository,
          useValue: {
            findApplicationForUser: jest.fn(),
            findManyByApplicationId: jest.fn(),
            findByIdForApplication: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(InterviewsService);
    repository = module.get(InterviewsRepository);
  });

  afterEach(() => jest.clearAllMocks());

  describe("list", () => {
    it("checks ownership and maps rows into the API shape", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findManyByApplicationId.mockResolvedValue([row]);

      const result = await service.list("user-1", "app-1");

      expect(repository.findApplicationForUser).toHaveBeenCalledWith("app-1", "user-1");
      expect(result).toEqual([
        {
          id: "int-1",
          kind: "TECHNICAL",
          scheduledAt: "2026-11-12T11:00:00.000Z",
          notes: null,
          createdAt: "2026-11-09T10:00:00.000Z",
          updatedAt: "2026-11-09T10:00:00.000Z",
        },
      ]);
    });

    it("throws NotFoundException for an application that isn't the user's", async () => {
      repository.findApplicationForUser.mockResolvedValue(null);

      await expect(service.list("user-1", "app-1")).rejects.toThrow(NotFoundException);
      expect(repository.findManyByApplicationId).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("stores the interview with a timeline entry", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.create.mockResolvedValue(row);

      await service.create("user-1", "app-1", { kind: "TECHNICAL", scheduledAt: "2026-11-12T11:00:00.000Z" });

      expect(repository.create).toHaveBeenCalledWith(
        "app-1",
        { kind: "TECHNICAL", scheduledAt: new Date("2026-11-12T11:00:00.000Z"), notes: null },
        { type: "INTERVIEW_SCHEDULED", description: "Technical interview scheduled" },
      );
    });

    it("throws NotFoundException without writing for an application that isn't the user's", async () => {
      repository.findApplicationForUser.mockResolvedValue(null);

      await expect(
        service.create("user-1", "app-1", { kind: "PHONE", scheduledAt: "2026-11-12T11:00:00.000Z" }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    beforeEach(() => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findByIdForApplication.mockResolvedValue(row);
      repository.update.mockResolvedValue(row);
    });

    it("logs a reschedule when the time changes, using the new kind if one was sent", async () => {
      await service.update("user-1", "app-1", "int-1", { kind: "ONSITE", scheduledAt: "2026-11-13T09:00:00.000Z" });

      expect(repository.update).toHaveBeenCalledWith(
        "int-1",
        "app-1",
        { kind: "ONSITE", scheduledAt: new Date("2026-11-13T09:00:00.000Z") },
        { type: "INTERVIEW_SCHEDULED", description: "Onsite interview rescheduled" },
      );
    });

    it("doesn't log anything when only the notes change or the same time is sent", async () => {
      await service.update("user-1", "app-1", "int-1", { notes: null });
      expect(repository.update).toHaveBeenLastCalledWith("int-1", "app-1", { notes: null }, null);

      await service.update("user-1", "app-1", "int-1", { scheduledAt: "2026-11-12T11:00:00.000Z" });
      expect(repository.update).toHaveBeenLastCalledWith(
        "int-1",
        "app-1",
        { scheduledAt: new Date("2026-11-12T11:00:00.000Z") },
        null,
      );
    });

    it("throws NotFoundException for an interview that isn't on that application", async () => {
      repository.findByIdForApplication.mockResolvedValue(null);

      await expect(service.update("user-1", "app-1", "int-x", { notes: "x" })).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("soft-deletes the interview with a timeline entry naming its kind", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findByIdForApplication.mockResolvedValue({ ...row, kind: "PHONE" });

      await service.cancel("user-1", "app-1", "int-1");

      expect(repository.findByIdForApplication).toHaveBeenCalledWith("int-1", "app-1");
      expect(repository.cancel).toHaveBeenCalledWith("int-1", "app-1", {
        type: "INTERVIEW_CANCELLED",
        description: "Phone interview cancelled",
      });
    });

    it("throws NotFoundException for an application that isn't the user's", async () => {
      repository.findApplicationForUser.mockResolvedValue(null);

      await expect(service.cancel("user-1", "app-1", "int-1")).rejects.toThrow(NotFoundException);
      expect(repository.cancel).not.toHaveBeenCalled();
    });
  });
});
