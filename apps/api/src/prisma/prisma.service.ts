import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { softDeleteExtension } from "./soft-delete.extension";

/**
 * The only place `PrismaClient` is instantiated (CLAUDE.md: Prisma is only
 * accessed from the service/repository layer). Repositories inject this
 * service and query through `prisma.client` — the soft-delete-extended
 * client — never a raw `PrismaClient`.
 *
 * Note: the soft-delete extension filters `findMany`/`findFirst` but not
 * `findUnique` (Prisma doesn't allow adding extra `where` filters there
 * without breaking its unique-lookup contract) — repositories that need a
 * soft-delete-aware unique lookup (e.g. by id) should use `findFirst`
 * instead of `findUnique`.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly rawClient = new PrismaClient();

  readonly client = this.rawClient.$extends(softDeleteExtension);

  async onModuleInit(): Promise<void> {
    await this.rawClient.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.rawClient.$disconnect();
  }
}
