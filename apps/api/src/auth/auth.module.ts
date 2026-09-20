import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repository";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";

@Module({
  // No default secret/expiry here — access and refresh tokens use different
  // secrets and TTLs, passed explicitly on every sign()/verify() call
  // (see AuthService), so JwtModule only provides the JwtService instance.
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, AccessTokenGuard, RefreshTokenGuard],
  // AccessTokenGuard is exported so other modules can protect their own
  // routes without redefining auth logic (see applications/applications.module.ts).
  exports: [AuthService, AccessTokenGuard],
})
export class AuthModule {}
