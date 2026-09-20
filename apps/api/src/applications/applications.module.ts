import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";
import { ApplicationsRepository } from "./applications.repository";

@Module({
  // AuthModule is imported for AccessTokenGuard, which the controller uses
  // to require a logged-in user.
  imports: [AuthModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationsRepository],
})
export class ApplicationsModule {}
