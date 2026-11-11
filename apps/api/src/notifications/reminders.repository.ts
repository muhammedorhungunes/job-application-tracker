import { Injectable } from "@nestjs/common";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const candidateSelect = {
  id: true,
  userId: true,
  position: true,
  status: true,
  updatedAt: true,
  user: { select: { email: true, name: true } },
  company: { select: { name: true } },
  reminders: { orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true } },
} satisfies Prisma.ApplicationSelect;

/** An application old enough to remind about, plus its most recent reminder (if any). */
export type ReminderCandidate = Prisma.ApplicationGetPayload<{ select: typeof candidateSelect }>;

export interface CandidateFilter {
  statuses: readonly ApplicationStatus[];
  updatedBefore: Date;
  userId: string;
}

const digestUserSelect = { id: true, timeZone: true, staleDays: true } satisfies Prisma.UserSelect;

/** A user who wants the stale digest, with the overrides that decide when and what it covers. */
export type DigestUser = Prisma.UserGetPayload<{ select: typeof digestUserSelect }>;

/** The only place in the notifications module that touches Prisma directly. */
@Injectable()
export class RemindersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Users with the digest turned on; deleted users are filtered by the soft-delete extension. */
  findDigestUsers(userId?: string): Promise<DigestUser[]> {
    return this.prisma.client.user.findMany({
      where: { staleDigestEnabled: true, ...(userId ? { id: userId } : {}) },
      select: digestUserSelect,
    });
  }

  /** Deleted applications are filtered by the soft-delete extension; deleted users here. */
  findCandidates(filter: CandidateFilter): Promise<ReminderCandidate[]> {
    return this.prisma.client.application.findMany({
      where: {
        status: { in: [...filter.statuses] },
        updatedAt: { lte: filter.updatedBefore },
        userId: filter.userId,
        user: { deletedAt: null },
      },
      orderBy: { updatedAt: "asc" },
      select: candidateSelect,
    });
  }

  async recordReminders(applicationIds: string[], sentAt: Date): Promise<void> {
    await this.prisma.client.applicationReminder.createMany({
      data: applicationIds.map((applicationId) => ({ applicationId, sentAt })),
    });
  }
}
