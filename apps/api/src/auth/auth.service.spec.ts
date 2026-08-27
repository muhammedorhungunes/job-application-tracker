import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repository";
import { AppConfigService } from "../config/app-config.service";

jest.mock("argon2", () => ({
  hash: jest.fn(async (value: string) => `hashed:${value}`),
  verify: jest.fn(async (hash: string, value: string) => hash === `hashed:${value}`),
}));

describe("AuthService", () => {
  let authService: AuthService;
  let authRepository: jest.Mocked<AuthRepository>;
  let jwtService: jest.Mocked<JwtService>;

  const fakeUser = {
    id: "user-1",
    email: "a@test.com",
    passwordHash: "hashed:password123",
    name: "A",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: {
            findUserByEmail: jest.fn(),
            findUserById: jest.fn(),
            createUser: jest.fn(),
            createRefreshToken: jest.fn(),
            findRefreshTokenById: jest.fn(),
            revokeRefreshToken: jest.fn(),
            revokeAllRefreshTokensForUser: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => "signed.jwt.token"),
            verify: jest.fn(),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            jwtAccessSecret: "access-secret",
            jwtAccessTtl: "15m",
            jwtRefreshSecret: "refresh-secret",
            jwtRefreshTtl: "30d",
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    authRepository = module.get(AuthRepository);
    jwtService = module.get(JwtService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("register", () => {
    it("creates a user and issues tokens when the email is free", async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue(fakeUser);

      const result = await authService.register({
        email: "a@test.com",
        password: "password123",
        name: "A",
      });

      expect(authRepository.createUser).toHaveBeenCalledWith({
        email: "a@test.com",
        passwordHash: "hashed:password123",
        name: "A",
      });
      expect(result.user).toEqual({ id: "user-1", email: "a@test.com", name: "A" });
      expect(result.tokens.accessToken).toBe("signed.jwt.token");
      expect(authRepository.createRefreshToken).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: "user-1", email: "a@test.com" },
        expect.objectContaining({ secret: "access-secret" }),
      );
    });

    it("rejects registration when the email is already taken", async () => {
      authRepository.findUserByEmail.mockResolvedValue(fakeUser);

      await expect(
        authService.register({ email: "a@test.com", password: "password123", name: "A" }),
      ).rejects.toThrow(ConflictException);
      expect(authRepository.createUser).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("issues tokens for a valid email/password pair", async () => {
      authRepository.findUserByEmail.mockResolvedValue(fakeUser);

      const result = await authService.login({ email: "a@test.com", password: "password123" });

      expect(result.user.id).toBe("user-1");
      expect(authRepository.createRefreshToken).toHaveBeenCalled();
    });

    it("rejects an unknown email", async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: "nobody@test.com", password: "password123" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejects a wrong password", async () => {
      authRepository.findUserByEmail.mockResolvedValue(fakeUser);

      await expect(
        authService.login({ email: "a@test.com", password: "wrong-password" }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("refresh", () => {
    const validRow = {
      id: "token-1",
      userId: "user-1",
      tokenHash: "hashed:raw-refresh-token",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
      createdAt: new Date(),
    };

    it("rotates the token and issues a new pair when the presented token is valid", async () => {
      authRepository.findRefreshTokenById.mockResolvedValue(validRow);
      authRepository.findUserById.mockResolvedValue(fakeUser);

      const tokens = await authService.refresh("raw-refresh-token", { sub: "user-1", jti: "token-1" });

      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith("token-1");
      expect(tokens.accessToken).toBe("signed.jwt.token");
    });

    it("revokes every session and rejects when a revoked token is replayed", async () => {
      authRepository.findRefreshTokenById.mockResolvedValue({
        ...validRow,
        revokedAt: new Date(),
      });

      await expect(
        authService.refresh("raw-refresh-token", { sub: "user-1", jti: "token-1" }),
      ).rejects.toThrow(UnauthorizedException);
      expect(authRepository.revokeAllRefreshTokensForUser).toHaveBeenCalledWith("user-1");
    });

    it("rejects an unknown token id", async () => {
      authRepository.findRefreshTokenById.mockResolvedValue(null);

      await expect(
        authService.refresh("raw-refresh-token", { sub: "user-1", jti: "missing" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejects an expired token", async () => {
      authRepository.findRefreshTokenById.mockResolvedValue({
        ...validRow,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        authService.refresh("raw-refresh-token", { sub: "user-1", jti: "token-1" }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
