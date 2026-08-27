import { z } from "zod";

export const RegisterInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(100),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

/** Public-safe user shape returned from auth endpoints — never includes passwordHash. */
export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;
