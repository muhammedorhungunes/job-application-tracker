import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ContactsController } from "./contacts.controller";
import { ContactsRepository } from "./contacts.repository";
import { ContactsService } from "./contacts.service";

@Module({
  // For AccessTokenGuard, same as ApplicationsModule.
  imports: [AuthModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
