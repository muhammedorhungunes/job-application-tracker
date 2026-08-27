import type { AccessTokenPayload, RefreshTokenPayload } from "../auth/auth.types";

/** Augments Express's Request with the fields the auth guards attach. */
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload | RefreshTokenPayload;
      rawRefreshToken?: string;
    }
  }
}

export {};
