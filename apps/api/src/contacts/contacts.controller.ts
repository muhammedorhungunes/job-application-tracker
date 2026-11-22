import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  CreateContactInputSchema,
  UpdateContactInputSchema,
  type Contact,
  type CreateContactInput,
  type UpdateContactInput,
} from "@job-tracker/types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import type { AccessTokenPayload } from "../auth/auth.types";
import { ContactsService } from "./contacts.service";

// Pipes are bound to @Body() rather than the method — see ApplicationsController.create.
@Controller("applications/:applicationId/contacts")
@UseGuards(AccessTokenGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async list(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Contact[]> {
    return this.contactsService.list(user.sub, applicationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("applicationId") applicationId: string,
    @Body(new ZodValidationPipe(CreateContactInputSchema)) body: CreateContactInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Contact> {
    return this.contactsService.create(user.sub, applicationId, body);
  }

  @Patch(":contactId")
  async update(
    @Param("applicationId") applicationId: string,
    @Param("contactId") contactId: string,
    @Body(new ZodValidationPipe(UpdateContactInputSchema)) body: UpdateContactInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<Contact> {
    return this.contactsService.update(user.sub, applicationId, contactId, body);
  }

  @Delete(":contactId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("applicationId") applicationId: string,
    @Param("contactId") contactId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<void> {
    await this.contactsService.delete(user.sub, applicationId, contactId);
  }
}
