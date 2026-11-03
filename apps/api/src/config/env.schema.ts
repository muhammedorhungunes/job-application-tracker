import { z } from "zod";

export const envSchema = z.object({
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
