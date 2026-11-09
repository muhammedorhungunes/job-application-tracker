import { Injectable } from "@nestjs/common";
import { Prisma, type Company } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { StatsRow } from "./application-stats";

const withCompany = { company: { select: { id: true, name: true } } } satisfies Prisma.ApplicationInclude;

/** Row shape returned when an application is fetched/created with its company attached. */
export type ApplicationWithCompany = Prisma.ApplicationGetPayload<{ include: typeof withCompany }>;

const activityFields = {
  id: true,
  type: true,
  description: true,
  fromStatus: true,
  toStatus: true,
  createdAt: true,
} satisfies Prisma.ActivitySelect;

export type ActivityRow = Prisma.ActivityGetPayload<{ select: typeof activityFields }>;

/** The only place in the applications module that touches Prisma directly. */
@Injectable()
export class ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByUserId(userId: string): Promise<ApplicationWithCompany[]> {
    return this.prisma.client.application.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: withCompany,
    });
  }

  /** Only the columns the stats calculation needs; soft-deleted rows are filtered by the extension. */
  async findStatsRowsByUserId(userId: string): Promise<StatsRow[]> {
    const rows = await this.prisma.client.application.findMany({
      where: { userId },
      select: {
        status: true,
        appliedAt: true,
        createdAt: true,
        updatedAt: true,
        // Nested selects bypass the soft-delete extension, hence the explicit filter.
        activities: { where: { deletedAt: null }, select: { fromStatus: true, toStatus: true } },
      },
    });
    // Both ends of every entry count: `fromStatus` also covers applications
    // created before history existed (their creation row has no toStatus).
    return rows.map(({ activities, ...row }) => ({
      ...row,
      reachedStatuses: activities.flatMap((a) => [a.fromStatus, a.toStatus]).filter((s) => s !== null),
    }));
  }

  // Bare id: ownership is the caller's job, same as updateApplication.
  // `id` as a tiebreaker keeps the order stable for same-millisecond entries.
  findActivitiesByApplicationId(applicationId: string): Promise<ActivityRow[]> {
    return this.prisma.client.activity.findMany({
      where: { applicationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: activityFields,
    });
  }

  /**
   * Bumps the application's updatedAt in the same transaction: a note means
   * the application is being followed up, so the stale-reminder rule (which
   * keys off updatedAt) shouldn't nag about it.
   */
  async createNote(applicationId: string, text: string): Promise<ActivityRow> {
    const [note] = await this.prisma.client.$transaction([
      this.prisma.client.activity.create({
        data: { applicationId, type: "NOTE", description: text },
        select: activityFields,
      }),
      this.prisma.client.application.update({ where: { id: applicationId }, data: { updatedAt: new Date() } }),
    ]);
    return note;
  }

  /** Only NOTE entries match, so system history can't be deleted through the notes route. */
  findNote(applicationId: string, noteId: string): Promise<{ id: string } | null> {
    return this.prisma.client.activity.findFirst({
      where: { id: noteId, applicationId, type: "NOTE" },
      select: { id: true },
    });
  }

  // Soft delete via the extension; caller checks ownership and type via findNote.
  async deleteNote(noteId: string): Promise<void> {
    await this.prisma.client.activity.delete({ where: { id: noteId } });
  }

  createApplication(data: Prisma.ApplicationUncheckedCreateInput): Promise<ApplicationWithCompany> {
    return this.prisma.client.application.create({ data, include: withCompany });
  }

  /** Scoped by userId so one user can never fetch (or, via update, touch) another's application. */
  findByIdForUser(id: string, userId: string): Promise<ApplicationWithCompany | null> {
    return this.prisma.client.application.findFirst({ where: { id, userId }, include: withCompany });
  }

  // Takes the bare id: ownership must already have been checked by the
  // caller (via findByIdForUser) since Prisma's unique `where` here can't
  // also filter by userId.
  updateApplication(
    id: string,
    data: Prisma.ApplicationUncheckedUpdateInput,
  ): Promise<ApplicationWithCompany> {
    return this.prisma.client.application.update({ where: { id }, data, include: withCompany });
  }

  // Same bare-id caveat as updateApplication: ownership is the caller's job.
  // `.delete()` is soft — the Prisma extension in prisma/soft-delete.extension.ts
  // rewrites it into an update that sets `deletedAt`, per CLAUDE.md (no hard deletes).
  deleteApplication(id: string): Promise<Prisma.ApplicationGetPayload<Record<string, never>>> {
    return this.prisma.client.application.delete({ where: { id } });
  }

  findCompanyByName(name: string): Promise<Company | null> {
    // Postgres-only `mode: "insensitive"` so "Google" and "google" resolve to
    // the same company row instead of silently duplicating it.
    return this.prisma.client.company.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  }

  createCompany(name: string): Promise<Company> {
    return this.prisma.client.company.create({ data: { name } });
  }
}
