import { Injectable, NotFoundException } from "@nestjs/common";
import type { ApplicationStatus, Company, Prisma } from "@prisma/client";
import type {
  Activity,
  Application,
  ApplicationListQuery,
  ApplicationStats,
  CreateApplicationInput,
  CreateNoteInput,
  UpdateApplicationInput,
} from "@job-tracker/types";
import { AppConfigService } from "../config/app-config.service";
import { computeApplicationStats } from "./application-stats";
import {
  ApplicationsRepository,
  type ActivityRow,
  type ApplicationListFilter,
  type ApplicationWithCompany,
} from "./applications.repository";

/** "INTERVIEWING" -> "Interviewing", for activity descriptions. */
function statusLabel(status: ApplicationStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Query dates are whole UTC days and `to` is inclusive, so the upper bound is the start of the next day. */
function toListFilter(query: ApplicationListQuery): ApplicationListFilter {
  return {
    search: query.q,
    statuses: query.status,
    tech: query.tech,
    dateFrom: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
    dateBefore: query.to ? new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + DAY_MS) : undefined,
  };
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly config: AppConfigService,
  ) {}

  async getStatsForUser(userId: string, now: Date = new Date()): Promise<ApplicationStats> {
    const rows = await this.applicationsRepository.findStatsRowsByUserId(userId);
    return computeApplicationStats(rows, { now, staleDays: this.config.reminderStaleDays });
  }

  async findAllForUser(userId: string, query: ApplicationListQuery = {}): Promise<Application[]> {
    const rows = await this.applicationsRepository.findManyByUserId(userId, toListFilter(query));
    return rows.map(this.toApplication);
  }

  /** Distinct tech stack entries across the user's applications, for the filter dropdown. */
  async getTechStackOptions(userId: string): Promise<string[]> {
    const rows = await this.applicationsRepository.findTechStacksByUserId(userId);
    const unique = new Set(rows.flatMap((row) => row.techStack));
    // ICU collation: case-insensitive order, lowercase first on ties ("react" before "React").
    return [...unique].sort((a, b) => a.localeCompare(b, "en"));
  }

  async findOneForUser(userId: string, applicationId: string): Promise<Application> {
    const row = await this.applicationsRepository.findByIdForUser(applicationId, userId);
    if (!row) {
      // Same "doesn't exist" vs "not yours" ambiguity as update()/remove().
      throw new NotFoundException("Application not found");
    }
    return this.toApplication(row);
  }

  /** Newest first. */
  async findActivitiesForUser(userId: string, applicationId: string): Promise<Activity[]> {
    await this.assertOwned(userId, applicationId);
    const rows = await this.applicationsRepository.findActivitiesByApplicationId(applicationId);
    return rows.map(this.toActivity);
  }

  async addNote(userId: string, applicationId: string, input: CreateNoteInput): Promise<Activity> {
    await this.assertOwned(userId, applicationId);
    const row = await this.applicationsRepository.createNote(applicationId, input.text);
    return this.toActivity(row);
  }

  async removeNote(userId: string, applicationId: string, noteId: string): Promise<void> {
    await this.assertOwned(userId, applicationId);
    const note = await this.applicationsRepository.findNote(applicationId, noteId);
    if (!note) {
      throw new NotFoundException("Note not found");
    }
    await this.applicationsRepository.deleteNote(noteId);
  }

  async create(userId: string, input: CreateApplicationInput): Promise<Application> {
    const company = await this.getOrCreateCompany(input.companyName);
    const status = input.status ?? "APPLIED";
    const row = await this.applicationsRepository.createApplication({
      userId,
      companyId: company.id,
      position: input.position,
      status,
      source: input.source ?? null,
      url: input.url ?? null,
      appliedAt: input.appliedAt ? new Date(input.appliedAt) : null,
      notes: input.notes ?? null,
      techStack: input.techStack ?? [],
      // Nested write: the application and its first history entry are
      // created atomically.
      activities: {
        create: { type: "APPLICATION_CREATED", toStatus: status, description: `Added as ${statusLabel(status)}` },
      },
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
    if (input.status && input.status !== existing.status) {
      // Only real changes are logged — e.g. a Kanban card dropped back into
      // its own column sends the same status and shouldn't add an entry.
      data.activities = {
        create: {
          type: "STATUS_CHANGE",
          fromStatus: existing.status,
          toStatus: input.status,
          description: `Status changed from ${statusLabel(existing.status)} to ${statusLabel(input.status)}`,
        },
      };
    }
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

  private async assertOwned(userId: string, applicationId: string): Promise<void> {
    const application = await this.applicationsRepository.findByIdForUser(applicationId, userId);
    if (!application) {
      throw new NotFoundException("Application not found");
    }
  }

  private toActivity(row: ActivityRow): Activity {
    return {
      id: row.id,
      type: row.type,
      description: row.description,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      createdAt: row.createdAt.toISOString(),
    };
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
