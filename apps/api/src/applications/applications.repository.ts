import { Injectable } from "@nestjs/common";
import { Prisma, type ApplicationStatus, type Company } from "@prisma/client";
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

/** List filters, already normalised by the service. Every field is optional and they combine with AND. */
export type ApplicationListFilter = {
  search?: string;
  statuses?: ApplicationStatus[];
  tech?: string;
  /** Inclusive lower / exclusive upper bound on appliedAt, falling back to createdAt. */
  dateFrom?: Date;
  dateBefore?: Date;
};

/** The only place in the applications module that touches Prisma directly. */
@Injectable()
export class ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByUserId(userId: string, filter: ApplicationListFilter = {}): Promise<ApplicationWithCompany[]> {
    return this.prisma.client.application.findMany({
      where: { userId, ...toWhere(filter) },
      orderBy: { createdAt: "desc" },
      include: withCompany,
    });
  }

  findTechStacksByUserId(userId: string): Promise<{ techStack: string[] }[]> {
    return this.prisma.client.application.findMany({ where: { userId }, select: { techStack: true } });
  }

  /** The user's reminder overrides, for the stats stale count (same threshold as the digest). */
  findUserReminderOverrides(userId: string): Promise<{ timeZone: string | null; staleDays: number | null } | null> {
    return this.prisma.client.user.findFirst({ where: { id: userId }, select: { timeZone: true, staleDays: true } });
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

  /**
   * All-or-nothing, for CSV import. Individual creates rather than createMany
   * because createMany can't write each application's nested history entry.
   */
  async createApplications(data: Prisma.ApplicationUncheckedCreateInput[]): Promise<number> {
    const created = await this.prisma.client.$transaction(
      data.map((row) => this.prisma.client.application.create({ data: row, select: { id: true } })),
    );
    return created.length;
  }

  /** The fields CSV import compares to skip applications the user already has. */
  findDuplicateKeyFieldsByUserId(
    userId: string,
  ): Promise<{ position: string; appliedAt: Date | null; company: { name: string } }[]> {
    return this.prisma.client.application.findMany({
      where: { userId },
      select: { position: true, appliedAt: true, company: { select: { name: true } } },
    });
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
  // Soft delete (CLAUDE.md: no hard deletes) written as an update rather than
  // the extension's delete() so the history entry lands in the same write.
  async archiveApplication(id: string): Promise<void> {
    await this.prisma.client.application.update({
      where: { id },
      data: { deletedAt: new Date(), activities: { create: { type: "ARCHIVED", description: "Archived" } } },
    });
  }

  /** Newest archive first. An explicit deletedAt filter overrides the extension's default. */
  findArchivedByUserId(userId: string): Promise<ApplicationWithCompany[]> {
    return this.prisma.client.application.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      include: withCompany,
    });
  }

  findArchivedByIdForUser(id: string, userId: string): Promise<{ id: string } | null> {
    return this.prisma.client.application.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: { id: true },
    });
  }

  // Bare id: ownership is the caller's job. Bumps updatedAt, so the stale
  // reminder treats a restore as activity rather than nagging right away.
  restoreApplication(id: string): Promise<ApplicationWithCompany> {
    return this.prisma.client.application.update({
      where: { id },
      data: { deletedAt: null, activities: { create: { type: "RESTORED", description: "Restored" } } },
      include: withCompany,
    });
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

function toWhere(filter: ApplicationListFilter): Prisma.ApplicationWhereInput {
  // Search and date range are both ORs, so each goes in its own AND entry.
  const and: Prisma.ApplicationWhereInput[] = [];
  if (filter.search) {
    // Prisma passes `contains` to ILIKE without escaping, so "%" or "_" would match anything.
    const escaped = filter.search.replace(/[\\%_]/g, "\\$&");
    const contains = { contains: escaped, mode: "insensitive" } as const;
    and.push({ OR: [{ position: contains }, { company: { name: contains } }] });
  }
  if (filter.dateFrom || filter.dateBefore) {
    const range = { gte: filter.dateFrom, lt: filter.dateBefore };
    and.push({ OR: [{ appliedAt: range }, { appliedAt: null, createdAt: range }] });
  }
  return {
    ...(filter.statuses ? { status: { in: filter.statuses } } : {}),
    ...(filter.tech ? { techStack: { has: filter.tech } } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}
