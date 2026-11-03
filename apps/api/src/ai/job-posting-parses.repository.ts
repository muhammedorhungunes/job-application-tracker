import { Injectable } from "@nestjs/common";
import type { JobPostingParse, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** The only place in the ai module that touches Prisma directly. */
@Injectable()
export class JobPostingParsesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, rawText: string): Promise<JobPostingParse> {
    return this.prisma.client.jobPostingParse.create({ data: { userId, rawText } });
  }

  findById(id: string): Promise<JobPostingParse | null> {
    return this.prisma.client.jobPostingParse.findFirst({ where: { id } });
  }

  /** Scoped by userId so one user can never read another's parse. */
  findByIdForUser(id: string, userId: string): Promise<JobPostingParse | null> {
    return this.prisma.client.jobPostingParse.findFirst({ where: { id, userId } });
  }

  markCompleted(
    id: string,
    data: { result: Prisma.InputJsonValue; model: string; inputTokens: number; outputTokens: number },
  ): Promise<JobPostingParse> {
    return this.prisma.client.jobPostingParse.update({
      where: { id },
      data: { ...data, status: "COMPLETED", errorMessage: null },
    });
  }

  markFailed(id: string, errorMessage: string): Promise<JobPostingParse> {
    return this.prisma.client.jobPostingParse.update({
      where: { id },
      data: { status: "FAILED", errorMessage },
    });
  }
}
