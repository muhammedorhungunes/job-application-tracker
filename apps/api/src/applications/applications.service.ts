import { Injectable, NotFoundException } from "@nestjs/common";
import type { Company, Prisma } from "@prisma/client";
import type { Application, CreateApplicationInput, UpdateApplicationInput } from "@job-tracker/types";
import { ApplicationsRepository, type ApplicationWithCompany } from "./applications.repository";

@Injectable()
export class ApplicationsService {
  constructor(private readonly applicationsRepository: ApplicationsRepository) {}

  async findAllForUser(userId: string): Promise<Application[]> {
    const rows = await this.applicationsRepository.findManyByUserId(userId);
    return rows.map(this.toApplication);
  }

  async findOneForUser(userId: string, applicationId: string): Promise<Application> {
    const row = await this.applicationsRepository.findByIdForUser(applicationId, userId);
    if (!row) {
      // Same "doesn't exist" vs "not yours" ambiguity as update()/remove().
      throw new NotFoundException("Application not found");
    }
    return this.toApplication(row);
  }

  async create(userId: string, input: CreateApplicationInput): Promise<Application> {
    const company = await this.getOrCreateCompany(input.companyName);
    const row = await this.applicationsRepository.createApplication({
      userId,
      companyId: company.id,
      position: input.position,
      status: input.status ?? "APPLIED",
      source: input.source ?? null,
      url: input.url ?? null,
      appliedAt: input.appliedAt ? new Date(input.appliedAt) : null,
      notes: input.notes ?? null,
      techStack: input.techStack ?? [],
    });
    return this.toApplication(row);
  }

  async update(userId: string, applicationId: string, input: UpdateApplicationInput): Promise<Application> {
    const existing = await this.applicationsRepository.findByIdForUser(applicationId, userId);
    if (!existing) {
      // Same response whether the id doesn't exist or belongs to someone
      // else — doesn't leak which of the two it is.
      throw new NotFoundException("Application not found");
    }

    const data: Prisma.ApplicationUncheckedUpdateInput = {};
    // Only fields the client actually sent are touched — checking `in`
    // (rather than `!== undefined`) is what lets `null` reach here to
    // intentionally clear a nullable field instead of being mistaken for
    // "not provided". See UpdateApplicationInputSchema's doc comment.
    if ("position" in input) data.position = input.position;
    if ("status" in input) data.status = input.status;
    if ("source" in input) data.source = input.source;
    if ("url" in input) data.url = input.url;
    if ("notes" in input) data.notes = input.notes;
    if ("techStack" in input) data.techStack = input.techStack;
    if ("appliedAt" in input) data.appliedAt = input.appliedAt ? new Date(input.appliedAt) : null;
    if ("companyName" in input && input.companyName) {
      const company = await this.getOrCreateCompany(input.companyName);
      data.companyId = company.id;
    }

    const row = await this.applicationsRepository.updateApplication(applicationId, data);
    return this.toApplication(row);
  }

  async remove(userId: string, applicationId: string): Promise<void> {
    const existing = await this.applicationsRepository.findByIdForUser(applicationId, userId);
    if (!existing) {
      // Same as update(): doesn't distinguish "doesn't exist" from "not
      // yours". Also naturally makes a repeat DELETE 404 instead of a silent
      // no-op, since the soft-delete extension excludes it from this lookup
      // once deletedAt is set.
      throw new NotFoundException("Application not found");
    }

    await this.applicationsRepository.deleteApplication(applicationId);
  }

  /**
   * There's no company management endpoint yet, so a create-application
   * request only carries a name. Looked up case-insensitively so "Google"
   * and "google" reuse the same row instead of splitting an applicant's
   * history across duplicate companies.
   *
   * Not race-safe under concurrent requests for the same new name (no
   * unique constraint on Company.name) — acceptable for a single-user app;
   * revisit if/when a real company-picker endpoint replaces this.
   */
  private async getOrCreateCompany(name: string): Promise<Company> {
    const existing = await this.applicationsRepository.findCompanyByName(name);
    if (existing) {
      return existing;
    }
    return this.applicationsRepository.createCompany(name);
  }

  private toApplication(row: ApplicationWithCompany): Application {
    return {
      id: row.id,
      position: row.position,
      status: row.status,
      source: row.source,
      url: row.url,
      appliedAt: row.appliedAt?.toISOString() ?? null,
      notes: row.notes,
      techStack: row.techStack,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      company: { id: row.company.id, name: row.company.name },
    };
  }
}
