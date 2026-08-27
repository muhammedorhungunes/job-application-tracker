import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  LoginInputSchema,
  RegisterInputSchema,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from "@job-tracker/types";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AppConfigService } from "../config/app-config.service";
import { AuthService } from "./auth.service";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { RefreshTokenGuard } from "./guards/refresh-token.guard";
import { parseDurationMs } from "./duration.util";
import type { AccessTokenPayload, IssuedTokens, RefreshTokenPayload } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(RegisterInputSchema))
  async register(
    @Body() body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const { user, tokens } = await this.authService.register(body);
    this.setAuthCookies(res, tokens);
    return user;
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginInputSchema))
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthUser> {
    const { user, tokens } = await this.authService.login(body);
    this.setAuthCookies(res, tokens);
    return user;
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ ok: true }> {
    const payload = req.user as RefreshTokenPayload;
    const rawRefreshToken = req.rawRefreshToken as string;
    const tokens = await this.authService.refresh(rawRefreshToken, payload);
    this.setAuthCookies(res, tokens);
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RefreshTokenGuard)
  async logout(@CurrentUser() payload: RefreshTokenPayload, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(payload);
    this.clearAuthCookies(res);
  }

  @Get("me")
  @UseGuards(AccessTokenGuard)
  async me(@CurrentUser() payload: AccessTokenPayload): Promise<AuthUser> {
    return this.authService.me(payload.sub);
  }

  private setAuthCookies(res: Response, tokens: IssuedTokens): void {
    const { sameSite, secure } = this.config.authCookieOptions;
    res.cookie("access_token", tokens.accessToken, {
      httpOnly: true,
      sameSite,
      secure,
      maxAge: parseDurationMs(tokens.accessTokenTtl),
    });
    res.cookie("refresh_token", tokens.refreshToken, {
      httpOnly: true,
      sameSite,
      secure,
      maxAge: parseDurationMs(tokens.refreshTokenTtl),
      path: "/auth",
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie("access_token");
    res.clearCookie("refresh_token", { path: "/auth" });
  }
}
