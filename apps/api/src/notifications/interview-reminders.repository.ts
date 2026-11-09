import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ClosedApplicationStatusValues } from "@job-tracker/types";

const dueSelect = {
  id: true,
  kind: true,
  scheduledAt: true,
  notes: true,
  application: {
    select: {
      id: true,
      position: true,
      company: { select: { name: true } },
      user: { select: { email: true, name: true } },
    },
  },
} satisfies Prisma.InterviewSelect;

export type DueInterview = Prisma.InterviewGetPayload<{ select: typeof dueSelect }>;

export interface DueFilter {
  /** Exclusive: interviews at or before this have already started. */
  from: Date;
  /** Inclusive end of the lead window. */
  to: Date;
  interviewId?: string;
}

/** The only place in interview reminders that touches Prisma directly. */
@Injectable()
export class InterviewRemindersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Interviews in the window that haven't been reminded about for their
   * current time. Cancelled interviews are filtered by the soft-delete
   * extension; the nested application/user filters are explicit because the
   * extension doesn't reach relation filters.
   */
  findDue(filter: DueFilter): Promise<DueInterview[]> {
    const interview = this.prisma.client.interview;
    return interview.findMany({
      where: {
        ...(filter.interviewId ? { id: filter.interviewId } : {}),
        scheduledAt: { gt: filter.from, lte: filter.to },
        // NULL <> x is NULL in SQL, so "never reminded" needs its own branch.
        OR: [
          { remindedForScheduledAt: null },
          { NOT: { remindedForScheduledAt: { equals: interview.fields.scheduledAt } } },
        ],
        application: {
          deletedAt: null,
          status: { notIn: [...ClosedApplicationStatusValues] },
          user: { deletedAt: null },
        },
      },
      orderBy: { scheduledAt: "asc" },
      select: dueSelect,
    });
  }

  async markReminded(interviewId: string, scheduledAt: Date): Promise<void> {
    await this.prisma.client.interview.update({
      where: { id: interviewId },
      data: { remindedForScheduledAt: scheduledAt },
    });
  }
}
