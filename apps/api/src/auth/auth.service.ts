import { randomUUID } from "node:crypto";
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type { AuthUser, LoginInput, RegisterInput } from "@job-tracker/types";
import { AppConfigService } from "../config/app-config.service";
import { AuthRepository } from "./auth.repository";
import { addDuration, parseDurationSeconds } from "./duration.util";
import type { AccessTokenPayload, IssuedTokens, RefreshTokenPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async register(input: RegisterInput): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    const existing = await this.authRepository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await this.authRepository.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.toAuthUser(user), tokens };
  }

  async login(input: LoginInput): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    const user = await this.authRepository.findUserByEmail(input.email);
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.toAuthUser(user), tokens };
  }

  async refresh(rawRefreshToken: string, payload: RefreshTokenPayload): Promise<IssuedTokens> {
    const tokenRow = await this.authRepository.findRefreshTokenById(payload.jti);
    if (!tokenRow || tokenRow.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    if (tokenRow.revokedAt) {
      // Reuse of an already-rotated token: treat as a stolen token and burn
      // every session this user has, forcing a fresh login everywhere.
      await this.authRepository.revokeAllRefreshTokensForUser(tokenRow.userId);
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    const presentedMatches = await argon2.verify(tokenRow.tokenHash, rawRefreshToken);
    if (!presentedMatches) {
      throw new UnauthorizedException("Refresh token is invalid");
    }

    const user = await this.authRepository.findUserById(tokenRow.userId);
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    await this.authRepository.revokeRefreshToken(tokenRow.id);
    return this.issueTokens(user.id, user.email);
  }

  async logout(payload: RefreshTokenPayload): Promise<void> {
    await this.authRepository.revokeRefreshToken(payload.jti);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }
    return this.toAuthUser(user);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify<AccessTokenPayload>(token, {
      secret: this.config.jwtAccessSecret,
    });
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.jwtService.verify<RefreshTokenPayload>(token, {
      secret: this.config.jwtRefreshSecret,
    });
  }

  private async issueTokens(userId: string, email: string): Promise<IssuedTokens> {
    const accessToken = this.jwtService.sign({ sub: userId, email } satisfies AccessTokenPayload, {
      secret: this.config.jwtAccessSecret,
      // A plain number is seconds (jsonwebtoken convention); our own
      // duration parser is the single source of truth for both this and
      // the RefreshToken row's expiresAt below, rather than relying on
      // jsonwebtoken's own (differently-typed) "15m"-style string parsing.
      expiresIn: parseDurationSeconds(this.config.jwtAccessTtl),
    });

    // The refresh JWT's `jti` is the RefreshToken row's id, generated up
    // front so it can be embedded before signing.
    const refreshTokenId = randomUUID();
    const refreshToken = this.jwtService.sign(
      { sub: userId, jti: refreshTokenId } satisfies RefreshTokenPayload,
      { secret: this.config.jwtRefreshSecret, expiresIn: parseDurationSeconds(this.config.jwtRefreshTtl) },
    );

    await this.authRepository.createRefreshToken({
      id: refreshTokenId,
      userId,
      tokenHash: await argon2.hash(refreshToken),
      expiresAt: addDuration(new Date(), this.config.jwtRefreshTtl),
    });

    return {
      accessToken,
      accessTokenTtl: this.config.jwtAccessTtl,
      refreshToken,
      refreshTokenTtl: this.config.jwtRefreshTtl,
    };
  }

  private toAuthUser(user: { id: string; email: string; name: string }): AuthUser {
    return { id: user.id, email: user.email, name: user.name };
  }
}
