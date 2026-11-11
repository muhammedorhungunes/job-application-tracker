import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "./env.schema";

/**
 * Typed wrapper around ConfigService so the rest of the app never calls
 * `process.env` or untyped `ConfigService.get()` directly (CLAUDE.md rule).
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env["NODE_ENV"] {
    return this.config.get("NODE_ENV", { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === "production";
  }

  get port(): number {
    return this.config.get("PORT", { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get("DATABASE_URL", { infer: true });
  }

  get jwtAccessSecret(): string {
    return this.config.get("JWT_ACCESS_SECRET", { infer: true });
  }

  get jwtAccessTtl(): string {
    return this.config.get("JWT_ACCESS_TTL", { infer: true });
  }

  get jwtRefreshSecret(): string {
    return this.config.get("JWT_REFRESH_SECRET", { infer: true });
  }

  get jwtRefreshTtl(): string {
    return this.config.get("JWT_REFRESH_TTL", { infer: true });
  }

  get webOrigin(): string {
    return this.config.get("WEB_ORIGIN", { infer: true });
  }

  get redisUrl(): string {
    return this.config.get("REDIS_URL", { infer: true });
  }

  get anthropicApiKey(): string {
    return this.config.get("ANTHROPIC_API_KEY", { infer: true });
  }

  get anthropicModel(): string {
    return this.config.get("ANTHROPIC_MODEL", { infer: true });
  }

  get resendApiKey(): string | undefined {
    return this.config.get("RESEND_API_KEY", { infer: true });
  }

  get emailFrom(): string {
    return this.config.get("EMAIL_FROM", { infer: true });
  }

  get reminderHour(): number {
    return this.config.get("REMINDER_HOUR", { infer: true });
  }

  get reminderTz(): string {
    return this.config.get("REMINDER_TZ", { infer: true });
  }

  get reminderStaleDays(): number {
    return this.config.get("REMINDER_STALE_DAYS", { infer: true });
  }

  get interviewReminderCron(): string {
    return this.config.get("INTERVIEW_REMINDER_CRON", { infer: true });
  }

  get interviewReminderLeadHours(): number {
    return this.config.get("INTERVIEW_REMINDER_LEAD_HOURS", { infer: true });
  }

  /** Cookie attributes differ between dev (same-site localhost) and prod.
   * The browser never receives these cookies directly — the web app's server
   * re-issues them on its own origin (apps/web/src/lib/auth-cookies.ts) — so
   * SameSite=None only matters for a client calling the API cross-site. */
  get authCookieOptions(): { sameSite: "lax" | "none"; secure: boolean } {
    return this.isProduction
      ? { sameSite: "none", secure: true }
      : { sameSite: "lax", secure: false };
  }
}
