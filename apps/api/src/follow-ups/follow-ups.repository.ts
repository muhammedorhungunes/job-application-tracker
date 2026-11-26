import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ClosedApplicationStatusValues } from "@job-tracker/types";
import { PrismaService } from "../prisma/prisma.service";

const followUpFields = {
  id: true,
  dueDate: true,
  note: true,
  doneAt: true,
  createdAt: true,
  updatedAt: true,
  // Nested selects bypass the soft-delete extension, so deletedAt is read and checked by the caller.
  contact: { select: { id: true, name: true, deletedAt: true } },
} satisfies Prisma.FollowUpSelect;

export type FollowUpRow = Prisma.FollowUpGetPayload<{ select: typeof followUpFields }>;

const dueFields = {
  ...followUpFields,
  application: { select: { id: true, position: true, status: true, company: { select: { id: true, name: true } } } },
} satisfies Prisma.FollowUpSelect;

export type DueFollowUpRow = Prisma.FollowUpGetPayload<{ select: typeof dueFields }>;

export interface FollowUpData {
  dueDate: Date;
  note: string;
  contactId: string | null;
}

/**
 * The only place in the follow-ups module that touches Prisma directly.
 *
 * Creating and editing write no timeline entry and leave
 * Application.updatedAt alone (a plan isn't a follow-up yet); markDone does both.
 */
@Injectable()
export class FollowUpsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Scoped by userId; soft-deleted applications are filtered by the extension. */
  findApplicationForUser(applicationId: string, userId: string): Promise<{ id: string } | null> {
    return this.prisma.client.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } });
  }

  /** Soft-deleted contacts are filtered by the extension. */
  findContactForApplication(contactId: string, applicationId: string): Promise<{ id: string } | null> {
    return this.prisma.client.contact.findFirst({ where: { id: contactId, applicationId }, select: { id: true } });
  }

  findUserTimeZone(userId: string): Promise<{ timeZone: string | null } | null> {
    return this.prisma.client.user.findFirst({ where: { id: userId }, select: { timeZone: true } });
  }

  /** Open ones first by due date, then done ones. */
  findManyByApplicationId(applicationId: string): Promise<FollowUpRow[]> {
    return this.prisma.client.followUp.findMany({
      where: { applicationId },
      orderBy: [{ doneAt: { sort: "desc", nulls: "first" } }, { dueDate: "asc" }, { createdAt: "asc" }],
      select: followUpFields,
    });
  }

  /**
   * Open follow-ups due on or before `dueOnOrBefore`, oldest first. The
   * application filters are explicit because the extension doesn't reach
   * relation filters.
   */
  findDueForUser(userId: string, dueOnOrBefore: Date): Promise<DueFollowUpRow[]> {
    return this.prisma.client.followUp.findMany({
      where: {
        doneAt: null,
        dueDate: { lte: dueOnOrBefore },
        application: { userId, deletedAt: null, status: { notIn: [...ClosedApplicationStatusValues] } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: dueFields,
    });
  }

  /** Bare applicationId: ownership is the caller's job. */
  findByIdForApplication(id: string, applicationId: string): Promise<FollowUpRow | null> {
    return this.prisma.client.followUp.findFirst({ where: { id, applicationId }, select: followUpFields });
  }

  create(applicationId: string, data: FollowUpData): Promise<FollowUpRow> {
    return this.prisma.client.followUp.create({ data: { applicationId, ...data }, select: followUpFields });
  }

  update(id: string, data: Prisma.FollowUpUncheckedUpdateInput): Promise<FollowUpRow> {
    return this.prisma.client.followUp.update({ where: { id }, data, select: followUpFields });
  }

  /**
   * Done is a real follow-up, so like a note it goes on the timeline and
   * bumps the application's updatedAt, which resets the stale reminder.
   */
  async markDone(id: string, applicationId: string, description: string, doneAt: Date): Promise<FollowUpRow> {
    const [followUp] = await this.prisma.client.$transaction([
      this.prisma.client.followUp.update({ where: { id }, data: { doneAt }, select: followUpFields }),
      this.prisma.client.activity.create({
        data: { applicationId, type: "FOLLOW_UP_DONE", description },
        select: { id: true },
      }),
      this.prisma.client.application.update({
        where: { id: applicationId },
        data: { updatedAt: doneAt },
        select: { id: true },
      }),
    ]);
    return followUp;
  }

  /** Soft delete through the extension's `delete` override. */
  async delete(id: string): Promise<void> {
    await this.prisma.client.followUp.delete({ where: { id } });
  }
}
