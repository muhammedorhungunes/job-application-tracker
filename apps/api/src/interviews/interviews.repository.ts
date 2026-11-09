import { Injectable } from "@nestjs/common";
import type { InterviewKind, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const interviewFields = {
  id: true,
  kind: true,
  scheduledAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InterviewSelect;

export type InterviewRow = Prisma.InterviewGetPayload<{ select: typeof interviewFields }>;

/** Timeline entry written alongside an interview change. */
export interface InterviewActivity {
  type: "INTERVIEW_SCHEDULED" | "INTERVIEW_CANCELLED";
  description: string;
}

/**
 * The only place in the interviews module that touches Prisma directly.
 *
 * Every write also bumps the application's updatedAt in the same
 * transaction: scheduling, moving or cancelling an interview means the
 * application is being followed up, so the stale-reminder rule (which keys
 * off updatedAt) shouldn't count it as silent.
 */
@Injectable()
export class InterviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Scoped by userId; soft-deleted applications are filtered by the extension. */
  findApplicationForUser(applicationId: string, userId: string): Promise<{ id: string } | null> {
    return this.prisma.client.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } });
  }

  findManyByApplicationId(applicationId: string): Promise<InterviewRow[]> {
    return this.prisma.client.interview.findMany({
      where: { applicationId },
      orderBy: { scheduledAt: "asc" },
      select: interviewFields,
    });
  }

  findByIdForApplication(id: string, applicationId: string): Promise<InterviewRow | null> {
    return this.prisma.client.interview.findFirst({ where: { id, applicationId }, select: interviewFields });
  }

  async create(
    applicationId: string,
    data: { kind: InterviewKind; scheduledAt: Date; notes: string | null },
    activity: InterviewActivity,
  ): Promise<InterviewRow> {
    const [interview] = await this.prisma.client.$transaction([
      this.prisma.client.interview.create({ data: { applicationId, ...data }, select: interviewFields }),
      this.activityWrite(applicationId, activity),
      this.touchApplication(applicationId),
    ]);
    return interview;
  }

  /** `activity` is null for edits that don't belong on the timeline (kind/notes only). */
  async update(
    id: string,
    applicationId: string,
    data: Prisma.InterviewUpdateInput,
    activity: InterviewActivity | null,
  ): Promise<InterviewRow> {
    const [interview] = await this.prisma.client.$transaction([
      this.prisma.client.interview.update({ where: { id }, data, select: interviewFields }),
      ...(activity ? [this.activityWrite(applicationId, activity)] : []),
      this.touchApplication(applicationId),
    ]);
    return interview;
  }

  /** Soft delete: sets deletedAt directly since it has to run inside the transaction. */
  async cancel(id: string, applicationId: string, activity: InterviewActivity): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.interview.update({ where: { id }, data: { deletedAt: new Date() } }),
      this.activityWrite(applicationId, activity),
      this.touchApplication(applicationId),
    ]);
  }

  private activityWrite(applicationId: string, activity: InterviewActivity) {
    return this.prisma.client.activity.create({ data: { applicationId, ...activity }, select: { id: true } });
  }

  private touchApplication(applicationId: string) {
    return this.prisma.client.application.update({
      where: { id: applicationId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });
  }
}
