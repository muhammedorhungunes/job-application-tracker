import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api-client";
import { AUTH_COOKIE_NAMES, authCookieOptions, buildAuthCookieHeader, parseAuthSetCookies } from "@/lib/auth-cookies";

/**
 * Server-only (uses `next/headers`): import from server components and
 * server actions, never from a client component.
 *
 * Calls the API as the logged-in user and validates the response with
 * `schema`. A 401 means the session is gone (middleware already tried a
 * refresh), so the user is sent to /login.
 */
// Typed structurally rather than as a zod v3 ZodType so the zod/v4 schemas
// in packages/types/src/ai.ts work here too; both versions expose parse().
export async function serverApiFetch<T>(
  path: string,
  schema: { parse: (data: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const store = await cookies();
  const cookieHeader = buildAuthCookieHeader((name) => store.get(name)?.value);

  try {
    const data = await apiFetch<unknown>(path, {
      ...init,
      headers: { ...init?.headers, ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
    });
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }
}

/** Re-issues the API's auth cookies on the web origin. Server actions only (cookies can't be set during render). */
export async function storeAuthCookies(setCookies: string[]): Promise<void> {
  const store = await cookies();
  for (const cookie of parseAuthSetCookies(setCookies)) {
    store.set(cookie.name, cookie.value, authCookieOptions(cookie.maxAge));
  }
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  for (const name of AUTH_COOKIE_NAMES) {
    store.delete(name);
  }
}
