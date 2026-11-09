import { Injectable, NotFoundException } from "@nestjs/common";
import type { InterviewKind, Prisma } from "@prisma/client";
import type { CreateInterviewInput, Interview, UpdateInterviewInput } from "@job-tracker/types";
import { InterviewsRepository, type InterviewRow } from "./interviews.repository";

const KIND_LABELS: Record<InterviewKind, string> = {
  PHONE: "Phone interview",
  TECHNICAL: "Technical interview",
  ONSITE: "Onsite interview",
  OTHER: "Interview",
};

// Timeline descriptions carry no date/time on purpose: the server would have
// to pick a time zone. The interview list shows the time in the viewer's zone.
@Injectable()
export class InterviewsService {
  constructor(private readonly interviewsRepository: InterviewsRepository) {}

  /** Soonest first. */
  async list(userId: string, applicationId: string): Promise<Interview[]> {
    await this.assertApplicationOwned(userId, applicationId);
    const rows = await this.interviewsRepository.findManyByApplicationId(applicationId);
    return rows.map(toInterview);
  }

  async create(userId: string, applicationId: string, input: CreateInterviewInput): Promise<Interview> {
    await this.assertApplicationOwned(userId, applicationId);
    const row = await this.interviewsRepository.create(
      applicationId,
      { kind: input.kind, scheduledAt: new Date(input.scheduledAt), notes: input.notes ?? null },
      { type: "INTERVIEW_SCHEDULED", description: `${KIND_LABELS[input.kind]} scheduled` },
    );
    return toInterview(row);
  }

  async update(
    userId: string,
    applicationId: string,
    interviewId: string,
    input: UpdateInterviewInput,
  ): Promise<Interview> {
    const existing = await this.getOwnedInterview(userId, applicationId, interviewId);

    const data: Prisma.InterviewUpdateInput = {};
    if ("kind" in input) data.kind = input.kind;
    if ("notes" in input) data.notes = input.notes;
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (scheduledAt) data.scheduledAt = scheduledAt;

    // Only a real time change is timeline-worthy; fixing the kind or notes isn't.
    const rescheduled = scheduledAt !== null && scheduledAt.getTime() !== existing.scheduledAt.getTime();
    const kind = input.kind ?? existing.kind;
    const row = await this.interviewsRepository.update(
      interviewId,
      applicationId,
      data,
      rescheduled ? { type: "INTERVIEW_SCHEDULED", description: `${KIND_LABELS[kind]} rescheduled` } : null,
    );
    return toInterview(row);
  }

  async cancel(userId: string, applicationId: string, interviewId: string): Promise<void> {
    const existing = await this.getOwnedInterview(userId, applicationId, interviewId);
    await this.interviewsRepository.cancel(interviewId, applicationId, {
      type: "INTERVIEW_CANCELLED",
      description: `${KIND_LABELS[existing.kind]} cancelled`,
    });
  }

  private async assertApplicationOwned(userId: string, applicationId: string): Promise<void> {
    const application = await this.interviewsRepository.findApplicationForUser(applicationId, userId);
    if (!application) {
      // Same response for "doesn't exist" and "not yours", like ApplicationsService.
      throw new NotFoundException("Application not found");
    }
  }

  private async getOwnedInterview(userId: string, applicationId: string, interviewId: string): Promise<InterviewRow> {
    await this.assertApplicationOwned(userId, applicationId);
    const interview = await this.interviewsRepository.findByIdForApplication(interviewId, applicationId);
    if (!interview) {
      throw new NotFoundException("Interview not found");
    }
    return interview;
  }
}

function toInterview(row: InterviewRow): Interview {
  return {
    id: row.id,
    kind: row.kind,
    scheduledAt: row.scheduledAt.toISOString(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
