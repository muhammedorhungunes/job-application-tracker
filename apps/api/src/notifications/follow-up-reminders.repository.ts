import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ClosedApplicationStatusValues } from "@job-tracker/types";
import { PrismaService } from "../prisma/prisma.service";

const userSelect = { id: true, email: true, name: true, timeZone: true } satisfies Prisma.UserSelect;

/** A user who wants follow-up reminder e-mails. */
export type FollowUpReminderUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

const dueSelect = {
  id: true,
  dueDate: true,
  note: true,
  // Nested selects bypass the soft-delete extension; the service drops removed contacts.
  contact: { select: { name: true, deletedAt: true } },
  application: { select: { id: true, position: true, company: { select: { name: true } } } },
} satisfies Prisma.FollowUpSelect;

export type UnremindedFollowUp = Prisma.FollowUpGetPayload<{ select: typeof dueSelect }>;

/** The only place in follow-up reminders that touches Prisma directly. */
@Injectable()
export class FollowUpRemindersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Deleted users are filtered by the soft-delete extension. */
  findUsers(userId?: string): Promise<FollowUpReminderUser[]> {
    return this.prisma.client.user.findMany({
      where: { followUpRemindersEnabled: true, ...(userId ? { id: userId } : {}) },
      select: userSelect,
    });
  }

  /**
   * Open follow-ups due on or before the day that no e-mail has mentioned
   * yet. Deleted follow-ups are filtered by the extension; the application
   * filters are explicit because it doesn't reach relation filters.
   */
  findUnreminded(userId: string, dueOnOrBefore: Date): Promise<UnremindedFollowUp[]> {
    return this.prisma.client.followUp.findMany({
      where: {
        doneAt: null,
        remindedAt: null,
        dueDate: { lte: dueOnOrBefore },
        application: { userId, deletedAt: null, status: { notIn: [...ClosedApplicationStatusValues] } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: dueSelect,
    });
  }

  async markReminded(followUpIds: string[], remindedAt: Date): Promise<void> {
    await this.prisma.client.followUp.updateMany({ where: { id: { in: followUpIds } }, data: { remindedAt } });
  }
}
