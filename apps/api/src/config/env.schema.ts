import { z } from "zod";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_TTL: z.string().default("30d"),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    REDIS_URL: z.string().url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-5-5"),
    // Optional outside production: without a key, emails are logged instead of sent.
    // An empty `RESEND_API_KEY=` line in .env counts as unset.
    RESEND_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
    EMAIL_FROM: z.string().min(1).default("Job Tracker <onboarding@resend.dev>"),
    REMINDER_CRON: z.string().min(1).default("0 9 * * *"),
    REMINDER_TZ: z.string().min(1).default("Europe/Istanbul"),
    REMINDER_STALE_DAYS: z.coerce.number().int().positive().default(7),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY is required in production",
      });
    }
  });
export type Env = z.infer<typeof envSchema>;

/** Used as ConfigModule's `validate` — throws on boot if the environment is invalid. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}
