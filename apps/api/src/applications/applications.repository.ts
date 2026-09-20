import { Injectable } from "@nestjs/common";
import { Prisma, type Company } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const withCompany = { company: { select: { id: true, name: true } } } satisfies Prisma.ApplicationInclude;

/** Row shape returned when an application is fetched/created with its company attached. */
export type ApplicationWithCompany = Prisma.ApplicationGetPayload<{ include: typeof withCompany }>;

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
