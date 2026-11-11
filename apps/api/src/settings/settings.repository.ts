import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const settingsSelect = {
  name: true,
  email: true,
  timeZone: true,
  staleDigestEnabled: true,
  staleDays: true,
  interviewRemindersEnabled: true,
} satisfies Prisma.UserSelect;

export type SettingsRow = Prisma.UserGetPayload<{ select: typeof settingsSelect }>;

/** The only place in the settings module that touches Prisma directly. */
@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Soft-deleted users are filtered by the extension. */
  findByUserId(userId: string): Promise<SettingsRow | null> {
    return this.prisma.client.user.findFirst({ where: { id: userId }, select: settingsSelect });
  }

  // Ownership is implicit: the id comes from the caller's access token.
  update(userId: string, data: Prisma.UserUpdateInput): Promise<SettingsRow> {
    return this.prisma.client.user.update({ where: { id: userId }, data, select: settingsSelect });
  }
}
