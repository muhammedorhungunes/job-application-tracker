import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AccessTokenPayload } from "../../auth/auth.types";

/** Reads the JWT payload an auth guard attached to the request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user as AccessTokenPayload;
});
