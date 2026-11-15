import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import {
  ApplicationImportInputSchema,
  ApplicationListQuerySchema,
  CreateApplicationInputSchema,
  CreateNoteInputSchema,
  UpdateApplicationInputSchema,
  type Activity,
  type Application,
  type ApplicationImportInput,
  type ApplicationImportResult,
  type ApplicationListQuery,
  type ApplicationStats,
  type ArchivedApplication,
  type CreateApplicationInput,
  type CreateNoteInput,
  type UpdateApplicationInput,
} from "@job-tracker/types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import type { AccessTokenPayload } from "../auth/auth.types";
import { ApplicationsService } from "./applications.service";

@Controller("applications")
@UseGuards(AccessTokenGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(ApplicationListQuerySchema)) query: ApplicationListQuery,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Application[]> {
    return this.applicationsService.findAllForUser(user.sub, query);
  }

  // Declared before @Get(":id") for the same reason as "stats".
  @Get("tech-stack")
  async techStack(@CurrentUser() user: AccessTokenPayload): Promise<string[]> {
    return this.applicationsService.getTechStackOptions(user.sub);
  }

  // Declared before @Get(":id") for the same reason as "stats". Takes the
  // board's filters, so the download matches what the user is looking at.
  @Get("export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  async exportCsv(
    @Query(new ZodValidationPipe(ApplicationListQuerySchema)) query: ApplicationListQuery,
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="applications-${day}.csv"`);
    return this.applicationsService.exportCsv(user.sub, query);
  }

  @Post("import")
  @HttpCode(HttpStatus.OK)
  async importCsv(
    @Body(new ZodValidationPipe(ApplicationImportInputSchema)) body: ApplicationImportInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<ApplicationImportResult> {
    return this.applicationsService.importCsv(user.sub, body.csv);
  }

  // Declared before @Get(":id") for the same reason as "stats".
  @Get("archived")
  async archived(@CurrentUser() user: AccessTokenPayload): Promise<ArchivedApplication[]> {
    return this.applicationsService.findArchivedForUser(user.sub);
  }

  // Declared before @Get(":id") so "stats" isn't captured as an id.
  @Get("stats")
  async stats(@CurrentUser() user: AccessTokenPayload): Promise<ApplicationStats> {
    return this.applicationsService.getStatsForUser(user.sub);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload): Promise<Application> {
    return this.applicationsService.findOneForUser(user.sub, id);
  }

  @Get(":id/activities")
  async findActivities(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload): Promise<Activity[]> {
    return this.applicationsService.findActivitiesForUser(user.sub, id);
  }

  @Post(":id/notes")
  @HttpCode(HttpStatus.CREATED)
  async addNote(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CreateNoteInputSchema)) body: CreateNoteInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Activity> {
    return this.applicationsService.addNote(user.sub, id, body);
  }

  @Delete(":id/notes/:noteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeNote(
    @Param("id") id: string,
    @Param("noteId") noteId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<void> {
    await this.applicationsService.removeNote(user.sub, id, noteId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    // The pipe is bound to @Body() directly, not via a method-level
    // @UsePipes(): a method-level pipe runs against every param Nest
    // considers pipeable — including @CurrentUser(), a custom decorator —
    // and CreateApplicationInputSchema then rejected the JWT payload
    // ({ sub, email }) as "position/companyName: Required" before the
    // actual body was ever read. Caught via a live curl smoke test, not
    // the unit tests (which mock the guard/pipe away entirely).
    @Body(new ZodValidationPipe(CreateApplicationInputSchema)) body: CreateApplicationInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Application> {
    return this.applicationsService.create(user.sub, body);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    // Pipe bound to @Body() for the same reason as create() above.
    @Body(new ZodValidationPipe(UpdateApplicationInputSchema)) body: UpdateApplicationInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Application> {
    return this.applicationsService.update(user.sub, id, body);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  async restore(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload): Promise<Application> {
    return this.applicationsService.restore(user.sub, id);
  }

  /** Archives (soft-deletes) the application; it can be restored via POST :id/restore. */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload): Promise<void> {
    await this.applicationsService.remove(user.sub, id);
  }
}
