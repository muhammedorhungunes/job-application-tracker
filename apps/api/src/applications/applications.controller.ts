import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  CreateApplicationInputSchema,
  UpdateApplicationInputSchema,
  type Application,
  type CreateApplicationInput,
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
  async findAll(@CurrentUser() user: AccessTokenPayload): Promise<Application[]> {
    return this.applicationsService.findAllForUser(user.sub);
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

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload): Promise<void> {
    await this.applicationsService.remove(user.sub, id);
  }
}
