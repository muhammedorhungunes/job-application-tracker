import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth.service";

interface RequestWithCookies extends Request {
  cookies: Record<string, string | undefined>;
}

/** Protects the refresh/logout routes (reads the `refresh_token` cookie). */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCookies>();
    const token = request.cookies["refresh_token"];
    if (!token) {
      throw new UnauthorizedException("Missing refresh token");
    }

    try {
      const payload = this.authService.verifyRefreshToken(token);
      request.user = payload;
      request.rawRefreshToken = token;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }
}
