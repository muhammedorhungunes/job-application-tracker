import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import type { Company } from "@prisma/client";
import { AppConfigService } from "../config/app-config.service";
import { ApplicationsService } from "./applications.service";
import { ApplicationsRepository, type ApplicationWithCompany } from "./applications.repository";

describe("ApplicationsService", () => {
  let applicationsService: ApplicationsService;
  let applicationsRepository: jest.Mocked<ApplicationsRepository>;

  const fakeRow: ApplicationWithCompany = {
    id: "app-1",
    userId: "user-1",
    companyId: "company-1",
    position: "Backend Engineer",
    status: "APPLIED",
    source: "LinkedIn",
    url: "https://example.com/job/1",
    appliedAt: new Date("2026-09-01T00:00:00.000Z"),
    notes: null,
    techStack: ["TypeScript", "NestJS"],
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    deletedAt: null,
    company: { id: "company-1", name: "Acme Inc" },
  };

  const fakeCompany: Company = {
    id: "company-1",
    name: "Acme Inc",
    website: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: ApplicationsRepository,
          useValue: {
            findManyByUserId: jest.fn(),
            findTechStacksByUserId: jest.fn(),
            createApplication: jest.fn(),
            findCompanyByName: jest.fn(),
            createCompany: jest.fn(),
            findByIdForUser: jest.fn(),
            updateApplication: jest.fn(),
            deleteApplication: jest.fn(),
            findStatsRowsByUserId: jest.fn(),
            findUserReminderOverrides: jest.fn().mockResolvedValue({ timeZone: null, staleDays: null }),
            findActivitiesByApplicationId: jest.fn(),
            createNote: jest.fn(),
            findNote: jest.fn(),
            deleteNote: jest.fn(),
          },
        },
        { provide: AppConfigService, useValue: { reminderStaleDays: 7, reminderTz: "Europe/Istanbul" } },
      ],
    }).compile();

    applicationsService = module.get(ApplicationsService);
    applicationsRepository = module.get(ApplicationsRepository);
  });

  afterEach(() => jest.clearAllMocks());

  describe("getStatsForUser", () => {
    it("computes stats from the user's rows using the configured stale threshold", async () => {
      const now = new Date("2026-11-06T12:00:00.000Z");
      applicationsRepository.findStatsRowsByUserId.mockResolvedValue([
        {
          status: "APPLIED",
          appliedAt: null,
          createdAt: new Date("2026-10-20T00:00:00.000Z"),
          updatedAt: new Date("2026-10-20T00:00:00.000Z"),
          reachedStatuses: [],
        },
        {
          status: "OFFER",
          appliedAt: new Date("2026-11-02T00:00:00.000Z"),
          createdAt: new Date("2026-11-02T00:00:00.000Z"),
          updatedAt: new Date("2026-11-05T00:00:00.000Z"),
          reachedStatuses: ["INTERVIEWING", "OFFER"],
        },
      ]);

      const stats = await applicationsService.getStatsForUser("user-1", now);

      expect(applicationsRepository.findStatsRowsByUserId).toHaveBeenCalledWith("user-1");
      expect(stats.total).toBe(2);
      expect(stats.byStatus).toMatchObject({ APPLIED: 1, OFFER: 1 });
      expect(stats.stale).toEqual({ count: 1, thresholdDays: 7 });
      expect(stats.weekly.at(-1)).toEqual({ weekStart: "2026-11-02", count: 1 });
    });

    it("uses the user's own stale threshold when set", async () => {
      applicationsRepository.findStatsRowsByUserId.mockResolvedValue([
        {
          status: "APPLIED",
          appliedAt: null,
          createdAt: new Date("2026-10-20T00:00:00.000Z"),
          updatedAt: new Date("2026-10-20T00:00:00.000Z"),
          reachedStatuses: [],
        },
      ]);
      applicationsRepository.findUserReminderOverrides.mockResolvedValue({ timeZone: null, staleDays: 30 });

      const stats = await applicationsService.getStatsForUser("user-1", new Date("2026-11-06T12:00:00.000Z"));

      expect(applicationsRepository.findUserReminderOverrides).toHaveBeenCalledWith("user-1");
      expect(stats.stale).toEqual({ count: 0, thresholdDays: 30 });
    });
  });

  describe("findAllForUser", () => {
    it("only asks the repository for the given user's applications", async () => {
      applicationsRepository.findManyByUserId.mockResolvedValue([]);

      await applicationsService.findAllForUser("user-1");

      expect(applicationsRepository.findManyByUserId).toHaveBeenCalledWith("user-1", {
        search: undefined,
        statuses: undefined,
        tech: undefined,
        dateFrom: undefined,
        dateBefore: undefined,
      });
    });

    it("passes search, statuses and tech through unchanged", async () => {
      applicationsRepository.findManyByUserId.mockResolvedValue([]);

      await applicationsService.findAllForUser("user-1", { q: "acme", status: ["APPLIED", "OFFER"], tech: "React" });

      expect(applicationsRepository.findManyByUserId).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ search: "acme", statuses: ["APPLIED", "OFFER"], tech: "React" }),
      );
    });

    it("turns from/to days into a UTC range that includes the whole `to` day", async () => {
      applicationsRepository.findManyByUserId.mockResolvedValue([]);

      await applicationsService.findAllForUser("user-1", { from: "2026-11-01", to: "2026-11-30" });

      expect(applicationsRepository.findManyByUserId).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          dateFrom: new Date("2026-11-01T00:00:00.000Z"),
          dateBefore: new Date("2026-12-01T00:00:00.000Z"),
        }),
      );
    });

    it("leaves the other bound open when only one date is given", async () => {
      applicationsRepository.findManyByUserId.mockResolvedValue([]);

      await applicationsService.findAllForUser("user-1", { to: "2026-12-31" });

      expect(applicationsRepository.findManyByUserId).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ dateFrom: undefined, dateBefore: new Date("2027-01-01T00:00:00.000Z") }),
      );
    });

    it("maps db rows into the API shape, serializing dates and the embedded company", async () => {
      applicationsRepository.findManyByUserId.mockResolvedValue([fakeRow]);

      const result = await applicationsService.findAllForUser("user-1");

      expect(result).toEqual([
        {
          id: "app-1",
          position: "Backend Engineer",
          status: "APPLIED",
          source: "LinkedIn",
          url: "https://example.com/job/1",
          appliedAt: "2026-09-01T00:00:00.000Z",
          notes: null,
          techStack: ["TypeScript", "NestJS"],
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
          company: { id: "company-1", name: "Acme Inc" },
        },
      ]);
    });

    it("maps a null appliedAt to null instead of throwing", async () => {
      applicationsRepository.findManyByUserId.mockResolvedValue([{ ...fakeRow, appliedAt: null }]);

      const [result] = await applicationsService.findAllForUser("user-1");

      expect(result.appliedAt).toBeNull();
    });
  });

  describe("getTechStackOptions", () => {
    it("returns distinct entries sorted case-insensitively", async () => {
      applicationsRepository.findTechStacksByUserId.mockResolvedValue([
        { techStack: ["TypeScript", "react"] },
        { techStack: [] },
        { techStack: ["Go", "TypeScript", "React"] },
      ]);

      const options = await applicationsService.getTechStackOptions("user-1");

      expect(applicationsRepository.findTechStacksByUserId).toHaveBeenCalledWith("user-1");
      expect(options).toEqual(["Go", "react", "React", "TypeScript"]);
    });
  });

  describe("findOneForUser", () => {
    it("looks the application up scoped to the user and maps it into the API shape", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);

      const result = await applicationsService.findOneForUser("user-1", "app-1");

      expect(applicationsRepository.findByIdForUser).toHaveBeenCalledWith("app-1", "user-1");
      expect(result).toEqual(
        expect.objectContaining({
          id: "app-1",
          appliedAt: "2026-09-01T00:00:00.000Z",
          company: { id: "company-1", name: "Acme Inc" },
        }),
      );
    });

    it("throws NotFoundException when the application doesn't exist or isn't the user's", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(applicationsService.findOneForUser("user-1", "missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findActivitiesForUser", () => {
    it("checks ownership, then maps the history into the API shape", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.findActivitiesByApplicationId.mockResolvedValue([
        {
          id: "act-2",
          type: "STATUS_CHANGE",
          description: "Status changed from Applied to Interviewing",
          fromStatus: "APPLIED",
          toStatus: "INTERVIEWING",
          createdAt: new Date("2026-09-03T00:00:00.000Z"),
        },
      ]);

      const result = await applicationsService.findActivitiesForUser("user-1", "app-1");

      expect(applicationsRepository.findByIdForUser).toHaveBeenCalledWith("app-1", "user-1");
      expect(applicationsRepository.findActivitiesByApplicationId).toHaveBeenCalledWith("app-1");
      expect(result).toEqual([
        {
          id: "act-2",
          type: "STATUS_CHANGE",
          description: "Status changed from Applied to Interviewing",
          fromStatus: "APPLIED",
          toStatus: "INTERVIEWING",
          createdAt: "2026-09-03T00:00:00.000Z",
        },
      ]);
    });

    it("throws NotFoundException without reading history when the application isn't the user's", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(applicationsService.findActivitiesForUser("user-1", "app-1")).rejects.toThrow(NotFoundException);
      expect(applicationsRepository.findActivitiesByApplicationId).not.toHaveBeenCalled();
    });
  });

  describe("addNote", () => {
    it("checks ownership, then stores the note and returns it as an activity", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.createNote.mockResolvedValue({
        id: "note-1",
        type: "NOTE",
        description: "Called the recruiter",
        fromStatus: null,
        toStatus: null,
        createdAt: new Date("2026-11-09T10:00:00.000Z"),
      });

      const result = await applicationsService.addNote("user-1", "app-1", { text: "Called the recruiter" });

      expect(applicationsRepository.findByIdForUser).toHaveBeenCalledWith("app-1", "user-1");
      expect(applicationsRepository.createNote).toHaveBeenCalledWith("app-1", "Called the recruiter");
      expect(result).toEqual(
        expect.objectContaining({ id: "note-1", type: "NOTE", createdAt: "2026-11-09T10:00:00.000Z" }),
      );
    });

    it("throws NotFoundException without writing when the application isn't the user's", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(applicationsService.addNote("user-1", "app-1", { text: "Hi" })).rejects.toThrow(NotFoundException);
      expect(applicationsRepository.createNote).not.toHaveBeenCalled();
    });
  });

  describe("removeNote", () => {
    it("deletes a note that belongs to the user's application", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.findNote.mockResolvedValue({ id: "note-1" });

      await applicationsService.removeNote("user-1", "app-1", "note-1");

      expect(applicationsRepository.findNote).toHaveBeenCalledWith("app-1", "note-1");
      expect(applicationsRepository.deleteNote).toHaveBeenCalledWith("note-1");
    });

    it("throws NotFoundException when the id isn't a note on that application", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.findNote.mockResolvedValue(null);

      await expect(applicationsService.removeNote("user-1", "app-1", "status-change-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(applicationsRepository.deleteNote).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the application isn't the user's", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(applicationsService.removeNote("user-1", "app-1", "note-1")).rejects.toThrow(NotFoundException);
      expect(applicationsRepository.findNote).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    const input = {
      position: "Backend Engineer",
      companyName: "Acme Inc",
    };

    it("reuses an existing company instead of creating a duplicate", async () => {
      applicationsRepository.findCompanyByName.mockResolvedValue({
        id: "company-1",
        name: "Acme Inc",
        website: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      applicationsRepository.createApplication.mockResolvedValue(fakeRow);

      await applicationsService.create("user-1", input);

      expect(applicationsRepository.findCompanyByName).toHaveBeenCalledWith("Acme Inc");
      expect(applicationsRepository.createCompany).not.toHaveBeenCalled();
      expect(applicationsRepository.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", companyId: "company-1", position: "Backend Engineer" }),
      );
    });

    it("records the initial status as the first history entry", async () => {
      applicationsRepository.findCompanyByName.mockResolvedValue(fakeCompany);
      applicationsRepository.createApplication.mockResolvedValue(fakeRow);

      await applicationsService.create("user-1", { ...input, status: "INTERVIEWING" });

      expect(applicationsRepository.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "INTERVIEWING",
          activities: {
            create: { type: "APPLICATION_CREATED", toStatus: "INTERVIEWING", description: "Added as Interviewing" },
          },
        }),
      );
    });

    it("defaults the initial status to APPLIED in both the row and its history", async () => {
      applicationsRepository.findCompanyByName.mockResolvedValue(fakeCompany);
      applicationsRepository.createApplication.mockResolvedValue(fakeRow);

      await applicationsService.create("user-1", input);

      expect(applicationsRepository.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "APPLIED",
          activities: { create: expect.objectContaining({ toStatus: "APPLIED" }) },
        }),
      );
    });

    it("creates the company when no match exists", async () => {
      applicationsRepository.findCompanyByName.mockResolvedValue(null);
      applicationsRepository.createCompany.mockResolvedValue({
        id: "company-2",
        name: "New Co",
        website: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      applicationsRepository.createApplication.mockResolvedValue({
        ...fakeRow,
        companyId: "company-2",
        company: { id: "company-2", name: "New Co" },
      });

      await applicationsService.create("user-1", { position: "Backend Engineer", companyName: "New Co" });

      expect(applicationsRepository.createCompany).toHaveBeenCalledWith("New Co");
      expect(applicationsRepository.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: "company-2" }),
      );
    });

    it("defaults optional fields (status, source, url, appliedAt, notes) sensibly", async () => {
      applicationsRepository.findCompanyByName.mockResolvedValue(null);
      applicationsRepository.createCompany.mockResolvedValue({
        id: "company-1",
        name: "Acme Inc",
        website: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      applicationsRepository.createApplication.mockResolvedValue(fakeRow);

      await applicationsService.create("user-1", input);

      expect(applicationsRepository.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "APPLIED",
          source: null,
          url: null,
          appliedAt: null,
          notes: null,
          techStack: [],
        }),
      );
    });

    it("passes a provided techStack through to the repository", async () => {
      applicationsRepository.findCompanyByName.mockResolvedValue(fakeCompany);
      applicationsRepository.createApplication.mockResolvedValue(fakeRow);

      await applicationsService.create("user-1", { ...input, techStack: ["TypeScript", "NestJS"] });

      expect(applicationsRepository.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({ techStack: ["TypeScript", "NestJS"] }),
      );
    });

    it("converts a provided appliedAt string into a Date for Prisma", async () => {
      applicationsRepository.findCompanyByName.mockResolvedValue(null);
      applicationsRepository.createCompany.mockResolvedValue({
        id: "company-1",
        name: "Acme Inc",
        website: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      applicationsRepository.createApplication.mockResolvedValue(fakeRow);

      await applicationsService.create("user-1", { ...input, appliedAt: "2026-09-01T00:00:00.000Z" });

      expect(applicationsRepository.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({ appliedAt: new Date("2026-09-01T00:00:00.000Z") }),
      );
    });

    it("returns the created application mapped into the API shape", async () => {
      applicationsRepository.findCompanyByName.mockResolvedValue({
        id: "company-1",
        name: "Acme Inc",
        website: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      applicationsRepository.createApplication.mockResolvedValue(fakeRow);

      const result = await applicationsService.create("user-1", input);

      expect(result).toEqual({
        id: "app-1",
        position: "Backend Engineer",
        status: "APPLIED",
        source: "LinkedIn",
        url: "https://example.com/job/1",
        appliedAt: "2026-09-01T00:00:00.000Z",
        notes: null,
        techStack: ["TypeScript", "NestJS"],
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
        company: { id: "company-1", name: "Acme Inc" },
      });
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the application doesn't exist or isn't the caller's", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(applicationsService.update("user-1", "app-1", { status: "OFFER" })).rejects.toThrow(
        NotFoundException,
      );
      expect(applicationsRepository.updateApplication).not.toHaveBeenCalled();
    });

    it("looks the application up scoped to the calling user", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.updateApplication.mockResolvedValue(fakeRow);

      await applicationsService.update("user-1", "app-1", { status: "OFFER" });

      expect(applicationsRepository.findByIdForUser).toHaveBeenCalledWith("app-1", "user-1");
    });

    it("only forwards fields that were actually sent, leaving the rest untouched", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.updateApplication.mockResolvedValue({ ...fakeRow, position: "Staff Engineer" });

      await applicationsService.update("user-1", "app-1", { position: "Staff Engineer" });

      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", { position: "Staff Engineer" });
    });

    it("records a status change in the history alongside the update", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.updateApplication.mockResolvedValue({ ...fakeRow, status: "INTERVIEWING" });

      await applicationsService.update("user-1", "app-1", { status: "INTERVIEWING" });

      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", {
        status: "INTERVIEWING",
        activities: {
          create: {
            type: "STATUS_CHANGE",
            fromStatus: "APPLIED",
            toStatus: "INTERVIEWING",
            description: "Status changed from Applied to Interviewing",
          },
        },
      });
    });

    it("doesn't record history when the status sent is the current one", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.updateApplication.mockResolvedValue(fakeRow);

      await applicationsService.update("user-1", "app-1", { status: "APPLIED" });

      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", { status: "APPLIED" });
    });

    it("forwards an explicit null to clear a nullable field", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.updateApplication.mockResolvedValue({ ...fakeRow, notes: null });

      await applicationsService.update("user-1", "app-1", { notes: null });

      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", { notes: null });
    });

    it("replaces techStack when it is sent", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.updateApplication.mockResolvedValue({ ...fakeRow, techStack: ["Go"] });

      const result = await applicationsService.update("user-1", "app-1", { techStack: ["Go"] });

      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", { techStack: ["Go"] });
      expect(result.techStack).toEqual(["Go"]);
    });

    it("converts a provided appliedAt string into a Date, and an explicit null into null", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.updateApplication.mockResolvedValue(fakeRow);

      await applicationsService.update("user-1", "app-1", { appliedAt: "2026-09-05T00:00:00.000Z" });
      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", {
        appliedAt: new Date("2026-09-05T00:00:00.000Z"),
      });

      await applicationsService.update("user-1", "app-1", { appliedAt: null });
      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", { appliedAt: null });
    });

    it("resolves a new companyName through find-or-create and sets companyId", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.findCompanyByName.mockResolvedValue(null);
      applicationsRepository.createCompany.mockResolvedValue({ ...fakeCompany, id: "company-2", name: "New Co" });
      applicationsRepository.updateApplication.mockResolvedValue({
        ...fakeRow,
        companyId: "company-2",
        company: { id: "company-2", name: "New Co" },
      });

      await applicationsService.update("user-1", "app-1", { companyName: "New Co" });

      expect(applicationsRepository.createCompany).toHaveBeenCalledWith("New Co");
      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", { companyId: "company-2" });
    });

    it("returns the updated application mapped into the API shape", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.updateApplication.mockResolvedValue({ ...fakeRow, position: "Staff Engineer" });

      const result = await applicationsService.update("user-1", "app-1", { position: "Staff Engineer" });

      expect(result.position).toBe("Staff Engineer");
      expect(result.company).toEqual({ id: "company-1", name: "Acme Inc" });
    });
  });

  describe("remove", () => {
    it("throws NotFoundException when the application doesn't exist or isn't the caller's", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(null);

      await expect(applicationsService.remove("user-1", "app-1")).rejects.toThrow(NotFoundException);
      expect(applicationsRepository.deleteApplication).not.toHaveBeenCalled();
    });

    it("looks the application up scoped to the calling user before deleting", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);

      await applicationsService.remove("user-1", "app-1");

      expect(applicationsRepository.findByIdForUser).toHaveBeenCalledWith("app-1", "user-1");
      expect(applicationsRepository.deleteApplication).toHaveBeenCalledWith("app-1");
    });
  });
});
