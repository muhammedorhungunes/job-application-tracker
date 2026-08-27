/** Backend-only JWT payload shapes — never shared with the frontend, which
 * never decodes these itself (it only ever sees httpOnly cookies). */
export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  accessTokenTtl: string;
  refreshToken: string;
  refreshTokenTtl: string;
}
