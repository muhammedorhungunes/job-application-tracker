import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import type { Company } from "@prisma/client";
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
            createApplication: jest.fn(),
            findCompanyByName: jest.fn(),
            createCompany: jest.fn(),
            findByIdForUser: jest.fn(),
            updateApplication: jest.fn(),
            deleteApplication: jest.fn(),
          },
        },
      ],
    }).compile();

    applicationsService = module.get(ApplicationsService);
    applicationsRepository = module.get(ApplicationsRepository);
  });

  afterEach(() => jest.clearAllMocks());

  describe("findAllForUser", () => {
    it("only asks the repository for the given user's applications", async () => {
      applicationsRepository.findManyByUserId.mockResolvedValue([]);

      await applicationsService.findAllForUser("user-1");

      expect(applicationsRepository.findManyByUserId).toHaveBeenCalledWith("user-1");
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
        }),
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
      applicationsRepository.updateApplication.mockResolvedValue({ ...fakeRow, status: "OFFER" });

      await applicationsService.update("user-1", "app-1", { status: "OFFER" });

      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", { status: "OFFER" });
    });

    it("forwards an explicit null to clear a nullable field", async () => {
      applicationsRepository.findByIdForUser.mockResolvedValue(fakeRow);
      applicationsRepository.updateApplication.mockResolvedValue({ ...fakeRow, notes: null });

      await applicationsService.update("user-1", "app-1", { notes: null });

      expect(applicationsRepository.updateApplication).toHaveBeenCalledWith("app-1", { notes: null });
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
