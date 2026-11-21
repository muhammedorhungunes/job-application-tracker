import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ApplicationStatus, Company, Prisma } from "@prisma/client";
import {
  salaryIssues,
  type Activity,
  type Application,
  type ApplicationImportError,
  type ApplicationImportResult,
  type ApplicationListQuery,
  type ApplicationStats,
  type ArchivedApplication,
  type CreateApplicationInput,
  type CreateNoteInput,
  type SalaryFields,
  type UpdateApplicationInput,
} from "@job-tracker/types";
import { AppConfigService } from "../config/app-config.service";
import { effectiveReminderSettings } from "../settings/effective-settings";
import { computeApplicationStats } from "./application-stats";
import { applicationsToCsv, csvToImportRows } from "./csv/application-csv";
import {
  ApplicationsRepository,
  type ActivityRow,
  type ApplicationListFilter,
  type ApplicationWithCompany,
} from "./applications.repository";

const SALARY_KEYS = ["salaryMin", "salaryMax", "salaryCurrency", "salaryPeriod"] as const;

/**
 * The salary columns to store. Without an amount there's no salary at all,
 * so a currency / period on its own (the form's defaults) isn't kept.
 * Amounts stay strings: Prisma accepts them for Decimal columns as-is.
 */
function salaryColumns(fields: SalaryFields) {
  const hasAmount = Boolean(fields.salaryMin || fields.salaryMax);
  return {
    salaryMin: fields.salaryMin ?? null,
    salaryMax: fields.salaryMax ?? null,
    salaryCurrency: hasAmount ? (fields.salaryCurrency ?? null) : null,
    salaryPeriod: hasAmount ? (fields.salaryPeriod ?? null) : null,
  };
}

/** "INTERVIEWING" -> "Interviewing", for activity descriptions. */
function statusLabel(status: ApplicationStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What makes two applications "the same" for CSV import: company and
 * position ignoring case, plus the UTC day applied (or no date at all).
 */
function duplicateKey(companyName: string, position: string, appliedAt: string | null): string {
  return JSON.stringify([companyName.trim().toLowerCase(), position.trim().toLowerCase(), appliedAt?.slice(0, 10) ?? null]);
}

/** Query dates are whole UTC days and `to` is inclusive, so the upper bound is the start of the next day. */
function toListFilter(query: ApplicationListQuery): ApplicationListFilter {
  return {
    search: query.q,
    statuses: query.status,
    tech: query.tech,
    workMode: query.workMode,
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
    const [rows, overrides] = await Promise.all([
      this.applicationsRepository.findStatsRowsByUserId(userId),
      this.applicationsRepository.findUserReminderOverrides(userId),
    ]);
    const { staleDays } = effectiveReminderSettings(overrides ?? { timeZone: null, staleDays: null }, {
      timeZone: this.config.reminderTz,
      staleDays: this.config.reminderStaleDays,
    });
    return computeApplicationStats(rows, { now, staleDays });
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
    const row = await this.applicationsRepository.createApplication(this.buildCreateData(userId, company.id, input, "Added"));
    return this.toApplication(row);
  }

  /** Same filters as the board, so "Export CSV" downloads what the user is looking at. */
  async exportCsv(userId: string, query: ApplicationListQuery = {}): Promise<string> {
    return applicationsToCsv(await this.findAllForUser(userId, query));
  }

  /**
   * All-or-nothing: any invalid row rejects the whole file, so a half-imported
   * file never has to be cleaned up. Rows matching an application the user
   * already has (or an earlier row of the same file) are skipped, so
   * re-uploading a file or an export doesn't duplicate anything.
   *
   * Runs inside the request rather than as a BullMQ job: it's at most
   * CSV_IMPORT_MAX_ROWS inserts in one transaction, not a slow external call.
   */
  async importCsv(userId: string, csv: string): Promise<ApplicationImportResult> {
    const parsed = csvToImportRows(csv);
    if (!parsed.ok) {
      const body: ApplicationImportError = { rows: parsed.errors };
      throw new BadRequestException(body);
    }

    const existing = await this.applicationsRepository.findDuplicateKeyFieldsByUserId(userId);
    const seen = new Set(
      existing.map((row) => duplicateKey(row.company.name, row.position, row.appliedAt?.toISOString() ?? null)),
    );
    const fresh = parsed.rows.filter(({ input }) => {
      const key = duplicateKey(input.companyName, input.position, input.appliedAt ?? null);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // One lookup per distinct company, not per row.
    const companyIds = new Map<string, string>();
    const data: Prisma.ApplicationUncheckedCreateInput[] = [];
    for (const { input } of fresh) {
      const name = input.companyName.toLowerCase();
      let companyId = companyIds.get(name);
      if (!companyId) {
        companyId = (await this.getOrCreateCompany(input.companyName)).id;
        companyIds.set(name, companyId);
      }
      data.push(this.buildCreateData(userId, companyId, input, "Imported"));
    }

    const imported = data.length > 0 ? await this.applicationsRepository.createApplications(data) : 0;
    return { imported, skippedDuplicates: parsed.rows.length - fresh.length };
  }

  /** `verb` only changes the first history entry's wording ("Added as Applied" / "Imported as Applied"). */
  private buildCreateData(
    userId: string,
    companyId: string,
    input: CreateApplicationInput,
    verb: "Added" | "Imported",
  ): Prisma.ApplicationUncheckedCreateInput {
    const status = input.status ?? "APPLIED";
    return {
      userId,
      companyId,
      position: input.position,
      status,
      source: input.source ?? null,
      url: input.url ?? null,
      appliedAt: input.appliedAt ? new Date(input.appliedAt) : null,
      notes: input.notes ?? null,
      techStack: input.techStack ?? [],
      location: input.location ?? null,
      workMode: input.workMode ?? null,
      ...salaryColumns(input),
      // Nested write: the application and its first history entry are
      // created atomically.
      activities: {
        create: { type: "APPLICATION_CREATED", toStatus: status, description: `${verb} as ${statusLabel(status)}` },
      },
    };
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
    if ("location" in input) data.location = input.location;
    if ("workMode" in input) data.workMode = input.workMode;
    if (SALARY_KEYS.some((key) => key in input)) {
      // A partial salary patch is checked against what's stored, e.g. a new
      // maximum below the existing minimum.
      const merged: SalaryFields = {
        salaryMin: "salaryMin" in input ? input.salaryMin : (existing.salaryMin?.toFixed(2) ?? null),
        salaryMax: "salaryMax" in input ? input.salaryMax : (existing.salaryMax?.toFixed(2) ?? null),
        salaryCurrency: "salaryCurrency" in input ? input.salaryCurrency : existing.salaryCurrency,
        salaryPeriod: "salaryPeriod" in input ? input.salaryPeriod : existing.salaryPeriod,
      };
      const issues = salaryIssues(merged);
      if (issues.length > 0) {
        // Same body shape as ZodValidationPipe (zod's flatten()), so clients handle both alike.
        const fieldErrors: Partial<Record<keyof SalaryFields, string[]>> = {};
        for (const issue of issues) (fieldErrors[issue.path] ??= []).push(issue.message);
        throw new BadRequestException({ formErrors: [], fieldErrors });
      }
      Object.assign(data, salaryColumns(merged));
    }
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

    await this.applicationsRepository.archiveApplication(applicationId);
  }

  /** Archived (soft-deleted) applications, newest archive first. */
  async findArchivedForUser(userId: string): Promise<ArchivedApplication[]> {
    const rows = await this.applicationsRepository.findArchivedByUserId(userId);
    return rows.map((row) => ({
      ...this.toApplication(row),
      // Always set: the query only returns rows with deletedAt.
      archivedAt: (row.deletedAt ?? row.updatedAt).toISOString(),
    }));
  }

  async restore(userId: string, applicationId: string): Promise<Application> {
    const archived = await this.applicationsRepository.findArchivedByIdForUser(applicationId, userId);
    if (!archived) {
      // Not archived, not found, or not yours: same response for all three.
      throw new NotFoundException("Archived application not found");
    }
    const row = await this.applicationsRepository.restoreApplication(applicationId);
    return this.toApplication(row);
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
      location: row.location,
      workMode: row.workMode,
      salaryMin: row.salaryMin?.toFixed(2) ?? null,
      salaryMax: row.salaryMax?.toFixed(2) ?? null,
      salaryCurrency: row.salaryCurrency,
      salaryPeriod: row.salaryPeriod,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      company: { id: row.company.id, name: row.company.name },
    };
  }
}
