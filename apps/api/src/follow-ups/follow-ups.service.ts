import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { CreateFollowUpInput, DueFollowUp, FollowUp, UpdateFollowUpInput } from "@job-tracker/types";
import { AppConfigService } from "../config/app-config.service";
import { localDate } from "../notifications/time-zone";
import { effectiveTimeZone } from "../settings/effective-settings";
import { fromDateOnly, toDateOnly } from "./follow-up-dates";
import { FollowUpsRepository, type DueFollowUpRow, type FollowUpRow } from "./follow-ups.repository";

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly repository: FollowUpsRepository,
    private readonly config: AppConfigService,
  ) {}

  async list(userId: string, applicationId: string): Promise<FollowUp[]> {
    await this.assertApplicationOwned(userId, applicationId);
    const rows = await this.repository.findManyByApplicationId(applicationId);
    return rows.map(toFollowUp);
  }

  /** Open follow-ups due today or earlier, where "today" is the user's own calendar day. */
  async listDue(userId: string, now: Date): Promise<DueFollowUp[]> {
    const user = await this.repository.findUserTimeZone(userId);
    const timeZone = effectiveTimeZone(user?.timeZone ?? null, this.config.reminderTz);
    const rows = await this.repository.findDueForUser(userId, fromDateOnly(localDate(now, timeZone)));
    return rows.map(toDueFollowUp);
  }

  async create(userId: string, applicationId: string, input: CreateFollowUpInput): Promise<FollowUp> {
    await this.assertApplicationOwned(userId, applicationId);
    if (input.contactId !== undefined) await this.assertContact(input.contactId, applicationId);
    const row = await this.repository.create(applicationId, {
      dueDate: fromDateOnly(input.dueDate),
      note: input.note,
      contactId: input.contactId ?? null,
    });
    return toFollowUp(row);
  }

  async update(
    userId: string,
    applicationId: string,
    followUpId: string,
    input: UpdateFollowUpInput,
  ): Promise<FollowUp> {
    const existing = await this.getOpenFollowUp(userId, applicationId, followUpId);

    const data: Prisma.FollowUpUncheckedUpdateInput = {};
    if (input.note !== undefined) data.note = input.note;
    if (input.contactId !== undefined) {
      if (input.contactId !== null) await this.assertContact(input.contactId, applicationId);
      data.contactId = input.contactId;
    }
    if (input.dueDate !== undefined && input.dueDate !== toDateOnly(existing.dueDate)) {
      data.dueDate = fromDateOnly(input.dueDate);
      // A new day gets its own reminder e-mail.
      data.remindedAt = null;
    }

    const row = await this.repository.update(followUpId, data);
    return toFollowUp(row);
  }

  async markDone(userId: string, applicationId: string, followUpId: string, now: Date): Promise<FollowUp> {
    const existing = await this.getOpenFollowUp(userId, applicationId, followUpId);
    const row = await this.repository.markDone(followUpId, applicationId, `Followed up: ${existing.note}`, now);
    return toFollowUp(row);
  }

  async delete(userId: string, applicationId: string, followUpId: string): Promise<void> {
    await this.getOwnedFollowUp(userId, applicationId, followUpId);
    await this.repository.delete(followUpId);
  }

  private async assertApplicationOwned(userId: string, applicationId: string): Promise<void> {
    const application = await this.repository.findApplicationForUser(applicationId, userId);
    if (!application) {
      // Same response for "doesn't exist" and "not yours", like ApplicationsService.
      throw new NotFoundException("Application not found");
    }
  }

  private async assertContact(contactId: string, applicationId: string): Promise<void> {
    const contact = await this.repository.findContactForApplication(contactId, applicationId);
    if (!contact) {
      throw new BadRequestException("Contact not found on this application");
    }
  }

  private async getOwnedFollowUp(userId: string, applicationId: string, followUpId: string): Promise<FollowUpRow> {
    await this.assertApplicationOwned(userId, applicationId);
    const followUp = await this.repository.findByIdForApplication(followUpId, applicationId);
    if (!followUp) {
      throw new NotFoundException("Follow-up not found");
    }
    return followUp;
  }

  /** Done follow-ups are history: they can be removed but not edited or completed again. */
  private async getOpenFollowUp(userId: string, applicationId: string, followUpId: string): Promise<FollowUpRow> {
    const followUp = await this.getOwnedFollowUp(userId, applicationId, followUpId);
    if (followUp.doneAt) {
      throw new BadRequestException("Follow-up is already done");
    }
    return followUp;
  }
}

function toFollowUp(row: FollowUpRow): FollowUp {
  return {
    id: row.id,
    dueDate: toDateOnly(row.dueDate),
    note: row.note,
    contact: row.contact && !row.contact.deletedAt ? { id: row.contact.id, name: row.contact.name } : null,
    doneAt: row.doneAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDueFollowUp(row: DueFollowUpRow): DueFollowUp {
  return { ...toFollowUp(row), application: row.application };
}
