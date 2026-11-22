import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const contactFields = {
  id: true,
  name: true,
  role: true,
  email: true,
  phone: true,
  linkedinUrl: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactSelect;

export type ContactRow = Prisma.ContactGetPayload<{ select: typeof contactFields }>;

export interface ContactData {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
}

/**
 * The only place in the contacts module that touches Prisma directly.
 *
 * Unlike interviews, writes here don't touch Application.updatedAt or the
 * timeline: saving who the recruiter is isn't following up on the
 * application, so it mustn't reset the stale reminder.
 */
@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Scoped by userId; soft-deleted applications are filtered by the extension. */
  findApplicationForUser(applicationId: string, userId: string): Promise<{ id: string } | null> {
    return this.prisma.client.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } });
  }

  findManyByApplicationId(applicationId: string): Promise<ContactRow[]> {
    return this.prisma.client.contact.findMany({
      where: { applicationId },
      orderBy: { createdAt: "asc" },
      select: contactFields,
    });
  }

  /** Bare applicationId: ownership is the caller's job. */
  findByIdForApplication(id: string, applicationId: string): Promise<ContactRow | null> {
    return this.prisma.client.contact.findFirst({ where: { id, applicationId }, select: contactFields });
  }

  create(applicationId: string, data: ContactData): Promise<ContactRow> {
    return this.prisma.client.contact.create({ data: { applicationId, ...data }, select: contactFields });
  }

  update(id: string, data: Prisma.ContactUpdateInput): Promise<ContactRow> {
    return this.prisma.client.contact.update({ where: { id }, data, select: contactFields });
  }

  /** Soft delete through the extension's `delete` override. */
  async delete(id: string): Promise<void> {
    await this.prisma.client.contact.delete({ where: { id } });
  }
}
