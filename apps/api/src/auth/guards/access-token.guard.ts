import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth.service";

interface RequestWithCookies extends Request {
  cookies: Record<string, string | undefined>;
}

/** Protects routes that require a logged-in user (reads the `access_token` cookie). */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCookies>();
    const token = request.cookies["access_token"];
    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    try {
      const payload = this.authService.verifyAccessToken(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}
