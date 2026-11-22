import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ContactsRepository, type ContactRow } from "./contacts.repository";
import { ContactsService } from "./contacts.service";

describe("ContactsService", () => {
  let service: ContactsService;
  let repository: jest.Mocked<ContactsRepository>;

  const row: ContactRow = {
    id: "con-1",
    name: "Jane Doe",
    role: "Recruiter",
    email: "jane@acme.example",
    phone: null,
    linkedinUrl: null,
    notes: null,
    createdAt: new Date("2026-11-23T10:00:00.000Z"),
    updatedAt: new Date("2026-11-23T10:00:00.000Z"),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContactsService,
        {
          provide: ContactsRepository,
          useValue: {
            findApplicationForUser: jest.fn(),
            findManyByApplicationId: jest.fn(),
            findByIdForApplication: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ContactsService);
    repository = module.get(ContactsRepository);
  });

  afterEach(() => jest.clearAllMocks());

  describe("list", () => {
    it("returns the application's contacts with ISO dates", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findManyByApplicationId.mockResolvedValue([row]);

      const result = await service.list("user-1", "app-1");

      expect(repository.findApplicationForUser).toHaveBeenCalledWith("app-1", "user-1");
      expect(result).toEqual([
        {
          id: "con-1",
          name: "Jane Doe",
          role: "Recruiter",
          email: "jane@acme.example",
          phone: null,
          linkedinUrl: null,
          notes: null,
          createdAt: "2026-11-23T10:00:00.000Z",
          updatedAt: "2026-11-23T10:00:00.000Z",
        },
      ]);
    });

    it("404s when the application isn't the user's", async () => {
      repository.findApplicationForUser.mockResolvedValue(null);

      await expect(service.list("user-1", "app-1")).rejects.toThrow(new NotFoundException("Application not found"));
      expect(repository.findManyByApplicationId).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("stores missing optional fields as null", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.create.mockResolvedValue(row);

      await service.create("user-1", "app-1", { name: "Jane Doe", role: "Recruiter", email: "jane@acme.example" });

      expect(repository.create).toHaveBeenCalledWith("app-1", {
        name: "Jane Doe",
        role: "Recruiter",
        email: "jane@acme.example",
        phone: null,
        linkedinUrl: null,
        notes: null,
      });
    });

    it("404s when the application isn't the user's", async () => {
      repository.findApplicationForUser.mockResolvedValue(null);

      await expect(service.create("user-1", "app-1", { name: "Jane" })).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("writes only the given keys, with null clearing a field", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findByIdForApplication.mockResolvedValue(row);
      repository.update.mockResolvedValue({ ...row, role: null, phone: "+49 30 1234" });

      const result = await service.update("user-1", "app-1", "con-1", { role: null, phone: "+49 30 1234" });

      expect(repository.findByIdForApplication).toHaveBeenCalledWith("con-1", "app-1");
      expect(repository.update).toHaveBeenCalledWith("con-1", { role: null, phone: "+49 30 1234" });
      expect(result).toEqual(expect.objectContaining({ role: null, phone: "+49 30 1234" }));
    });

    it("404s when the contact isn't on this application", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findByIdForApplication.mockResolvedValue(null);

      await expect(service.update("user-1", "app-1", "con-1", { name: "X" })).rejects.toThrow(
        new NotFoundException("Contact not found"),
      );
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes an owned contact", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findByIdForApplication.mockResolvedValue(row);

      await service.delete("user-1", "app-1", "con-1");

      expect(repository.delete).toHaveBeenCalledWith("con-1");
    });

    it("404s when the application isn't the user's", async () => {
      repository.findApplicationForUser.mockResolvedValue(null);

      await expect(service.delete("user-1", "app-1", "con-1")).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
