import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppConfigService } from "../config/app-config.service";
import { FollowUpsRepository, type DueFollowUpRow, type FollowUpRow } from "./follow-ups.repository";
import { FollowUpsService } from "./follow-ups.service";

describe("FollowUpsService", () => {
  let service: FollowUpsService;
  let repository: jest.Mocked<FollowUpsRepository>;

  const row: FollowUpRow = {
    id: "fu-1",
    dueDate: new Date("2026-12-03T00:00:00.000Z"),
    note: "E-mail Jane again",
    doneAt: null,
    createdAt: new Date("2026-11-27T10:00:00.000Z"),
    updatedAt: new Date("2026-11-27T10:00:00.000Z"),
    contact: { id: "con-1", name: "Jane Doe", deletedAt: null },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FollowUpsService,
        { provide: AppConfigService, useValue: { reminderTz: "Europe/Istanbul" } },
        {
          provide: FollowUpsRepository,
          useValue: {
            findApplicationForUser: jest.fn(),
            findContactForApplication: jest.fn(),
            findUserTimeZone: jest.fn(),
            findManyByApplicationId: jest.fn(),
            findDueForUser: jest.fn(),
            findByIdForApplication: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            markDone: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FollowUpsService);
    repository = module.get(FollowUpsRepository);
  });

  afterEach(() => jest.clearAllMocks());

  /** The application and follow-up both exist and belong to the user. */
  function owned(followUp: FollowUpRow = row): void {
    repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
    repository.findByIdForApplication.mockResolvedValue(followUp);
  }

  describe("list", () => {
    it("returns date-only due dates and the contact", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findManyByApplicationId.mockResolvedValue([row]);

      const result = await service.list("user-1", "app-1");

      expect(repository.findApplicationForUser).toHaveBeenCalledWith("app-1", "user-1");
      expect(result).toEqual([
        {
          id: "fu-1",
          dueDate: "2026-12-03",
          note: "E-mail Jane again",
          contact: { id: "con-1", name: "Jane Doe" },
          doneAt: null,
          createdAt: "2026-11-27T10:00:00.000Z",
          updatedAt: "2026-11-27T10:00:00.000Z",
        },
      ]);
    });

    it("hides a removed contact", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findManyByApplicationId.mockResolvedValue([
        { ...row, contact: { id: "con-1", name: "Jane Doe", deletedAt: new Date() } },
      ]);

      const [result] = await service.list("user-1", "app-1");

      expect(result?.contact).toBeNull();
    });

    it("404s when the application isn't the user's", async () => {
      repository.findApplicationForUser.mockResolvedValue(null);

      await expect(service.list("user-1", "app-1")).rejects.toThrow(new NotFoundException("Application not found"));
      expect(repository.findManyByApplicationId).not.toHaveBeenCalled();
    });
  });

  describe("listDue", () => {
    const dueRow: DueFollowUpRow = {
      ...row,
      application: { id: "app-1", position: "Engineer", status: "APPLIED", company: { id: "co-1", name: "Acme" } },
    };

    it("uses the user's own calendar day", async () => {
      repository.findUserTimeZone.mockResolvedValue({ timeZone: "America/New_York" });
      repository.findDueForUser.mockResolvedValue([dueRow]);

      // 02:00 UTC on Dec 3 is still Dec 2 in New York.
      const result = await service.listDue("user-1", new Date("2026-12-03T02:00:00.000Z"));

      expect(repository.findDueForUser).toHaveBeenCalledWith("user-1", new Date("2026-12-02T00:00:00.000Z"));
      expect(result[0]).toMatchObject({ id: "fu-1", dueDate: "2026-12-03", application: dueRow.application });
    });

    it("falls back to REMINDER_TZ when the user has no zone", async () => {
      repository.findUserTimeZone.mockResolvedValue({ timeZone: null });
      repository.findDueForUser.mockResolvedValue([]);

      // 22:00 UTC on Dec 2 is already Dec 3 in Istanbul (UTC+3).
      await service.listDue("user-1", new Date("2026-12-02T22:00:00.000Z"));

      expect(repository.findDueForUser).toHaveBeenCalledWith("user-1", new Date("2026-12-03T00:00:00.000Z"));
    });
  });

  describe("create", () => {
    it("stores the day as UTC midnight and no contact as null", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.create.mockResolvedValue({ ...row, contact: null });

      await service.create("user-1", "app-1", { dueDate: "2026-12-03", note: "E-mail Jane again" });

      expect(repository.findContactForApplication).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith("app-1", {
        dueDate: new Date("2026-12-03T00:00:00.000Z"),
        note: "E-mail Jane again",
        contactId: null,
      });
    });

    it("accepts a contact on the same application", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findContactForApplication.mockResolvedValue({ id: "con-1" });
      repository.create.mockResolvedValue(row);

      await service.create("user-1", "app-1", { dueDate: "2026-12-03", note: "Ping", contactId: "con-1" });

      expect(repository.findContactForApplication).toHaveBeenCalledWith("con-1", "app-1");
      expect(repository.create).toHaveBeenCalledWith("app-1", expect.objectContaining({ contactId: "con-1" }));
    });

    it("rejects a contact from elsewhere", async () => {
      repository.findApplicationForUser.mockResolvedValue({ id: "app-1" });
      repository.findContactForApplication.mockResolvedValue(null);

      await expect(
        service.create("user-1", "app-1", { dueDate: "2026-12-03", note: "Ping", contactId: "con-9" }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("404s when the application isn't the user's", async () => {
      repository.findApplicationForUser.mockResolvedValue(null);

      await expect(service.create("user-1", "app-1", { dueDate: "2026-12-03", note: "Ping" })).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("clears remindedAt when the day changes", async () => {
      owned();
      repository.update.mockResolvedValue({ ...row, dueDate: new Date("2026-12-05T00:00:00.000Z") });

      const result = await service.update("user-1", "app-1", "fu-1", { dueDate: "2026-12-05" });

      expect(repository.update).toHaveBeenCalledWith("fu-1", {
        dueDate: new Date("2026-12-05T00:00:00.000Z"),
        remindedAt: null,
      });
      expect(result.dueDate).toBe("2026-12-05");
    });

    it("keeps remindedAt when the same day is sent again", async () => {
      owned();
      repository.update.mockResolvedValue(row);

      await service.update("user-1", "app-1", "fu-1", { dueDate: "2026-12-03", note: "New text" });

      expect(repository.update).toHaveBeenCalledWith("fu-1", { note: "New text" });
    });

    it("clears the contact with null without looking it up", async () => {
      owned();
      repository.update.mockResolvedValue({ ...row, contact: null });

      await service.update("user-1", "app-1", "fu-1", { contactId: null });

      expect(repository.findContactForApplication).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith("fu-1", { contactId: null });
    });

    it("checks a new contact", async () => {
      owned();
      repository.findContactForApplication.mockResolvedValue(null);

      await expect(service.update("user-1", "app-1", "fu-1", { contactId: "con-9" })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("refuses to edit a done follow-up", async () => {
      owned({ ...row, doneAt: new Date() });

      await expect(service.update("user-1", "app-1", "fu-1", { note: "X" })).rejects.toThrow(
        new BadRequestException("Follow-up is already done"),
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("404s when the follow-up isn't on this application", async () => {
      owned();
      repository.findByIdForApplication.mockResolvedValue(null);

      await expect(service.update("user-1", "app-1", "fu-1", { note: "X" })).rejects.toThrow(
        new NotFoundException("Follow-up not found"),
      );
    });
  });

  describe("markDone", () => {
    it("records it on the timeline with the note", async () => {
      const now = new Date("2026-12-03T09:30:00.000Z");
      owned();
      repository.markDone.mockResolvedValue({ ...row, doneAt: now });

      const result = await service.markDone("user-1", "app-1", "fu-1", now);

      expect(repository.markDone).toHaveBeenCalledWith("fu-1", "app-1", "Followed up: E-mail Jane again", now);
      expect(result.doneAt).toBe("2026-12-03T09:30:00.000Z");
    });

    it("can't be done twice", async () => {
      owned({ ...row, doneAt: new Date() });

      await expect(service.markDone("user-1", "app-1", "fu-1", new Date())).rejects.toThrow(BadRequestException);
      expect(repository.markDone).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes an owned follow-up, done or not", async () => {
      owned({ ...row, doneAt: new Date() });

      await service.delete("user-1", "app-1", "fu-1");

      expect(repository.delete).toHaveBeenCalledWith("fu-1");
    });

    it("404s when the application isn't the user's", async () => {
      repository.findApplicationForUser.mockResolvedValue(null);

      await expect(service.delete("user-1", "app-1", "fu-1")).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
