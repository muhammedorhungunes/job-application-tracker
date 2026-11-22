import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { Contact, CreateContactInput, UpdateContactInput } from "@job-tracker/types";
import { ContactsRepository, type ContactRow } from "./contacts.repository";

@Injectable()
export class ContactsService {
  constructor(private readonly contactsRepository: ContactsRepository) {}

  /** Oldest first, so the list doesn't reshuffle as contacts are added. */
  async list(userId: string, applicationId: string): Promise<Contact[]> {
    await this.assertApplicationOwned(userId, applicationId);
    const rows = await this.contactsRepository.findManyByApplicationId(applicationId);
    return rows.map(toContact);
  }

  async create(userId: string, applicationId: string, input: CreateContactInput): Promise<Contact> {
    await this.assertApplicationOwned(userId, applicationId);
    const row = await this.contactsRepository.create(applicationId, {
      name: input.name,
      role: input.role ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      notes: input.notes ?? null,
    });
    return toContact(row);
  }

  async update(userId: string, applicationId: string, contactId: string, input: UpdateContactInput): Promise<Contact> {
    await this.getOwnedContact(userId, applicationId, contactId);

    // Only keys present in the input are written; `null` clears a field.
    const data: Prisma.ContactUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.role !== undefined) data.role = input.role;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.linkedinUrl !== undefined) data.linkedinUrl = input.linkedinUrl;
    if (input.notes !== undefined) data.notes = input.notes;

    const row = await this.contactsRepository.update(contactId, data);
    return toContact(row);
  }

  async delete(userId: string, applicationId: string, contactId: string): Promise<void> {
    await this.getOwnedContact(userId, applicationId, contactId);
    await this.contactsRepository.delete(contactId);
  }

  private async assertApplicationOwned(userId: string, applicationId: string): Promise<void> {
    const application = await this.contactsRepository.findApplicationForUser(applicationId, userId);
    if (!application) {
      // Same response for "doesn't exist" and "not yours", like ApplicationsService.
      throw new NotFoundException("Application not found");
    }
  }

  private async getOwnedContact(userId: string, applicationId: string, contactId: string): Promise<ContactRow> {
    await this.assertApplicationOwned(userId, applicationId);
    const contact = await this.contactsRepository.findByIdForApplication(contactId, applicationId);
    if (!contact) {
      throw new NotFoundException("Contact not found");
    }
    return contact;
  }
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    linkedinUrl: row.linkedinUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
