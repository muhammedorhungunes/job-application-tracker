/**
 * The web app (Vercel) and the API (Railway) live on different sites, so the
 * browser would treat the API's own auth cookies as third-party and drop
 * them. Instead the browser only ever talks to the web app: server actions /
 * middleware call the API, and the auth cookies it returns are re-issued on
 * the web origin with the same names, values and lifetimes. Server-side API
 * calls then forward them back as a `Cookie` header.
 *
 * Pure helpers only — no `next/headers` — so both middleware and server code
 * can use them.
 */
export const AUTH_COOKIE_NAMES = ["access_token", "refresh_token"] as const;
export type AuthCookieName = (typeof AUTH_COOKIE_NAMES)[number];

export interface AuthCookie {
  name: AuthCookieName;
  value: string;
  /** Seconds, taken from the API's `Max-Age` attribute. */
  maxAge: number | undefined;
}

function isAuthCookieName(name: string): name is AuthCookieName {
  return (AUTH_COOKIE_NAMES as readonly string[]).includes(name);
}

/** Picks the auth cookies out of raw Set-Cookie lines; anything else is ignored. */
export function parseAuthSetCookies(setCookies: string[]): AuthCookie[] {
  const result: AuthCookie[] = [];
  for (const line of setCookies) {
    const [pair = "", ...attributes] = line.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;

    const name = pair.slice(0, separator);
    if (!isAuthCookieName(name)) continue;

    const maxAgeAttr = attributes.find((attr) => attr.toLowerCase().startsWith("max-age="));
    const maxAge = maxAgeAttr ? Number(maxAgeAttr.slice("max-age=".length)) : undefined;

    result.push({
      name,
      value: decodeURIComponent(pair.slice(separator + 1)),
      maxAge: maxAge !== undefined && Number.isFinite(maxAge) ? maxAge : undefined,
    });
  }
  return result;
}

export function authCookieOptions(maxAge: number | undefined) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    // Unlike the API (which scopes refresh_token to /auth), every web route
    // forwards both cookies, and middleware needs to read refresh_token.
    path: "/",
    maxAge,
  };
}

/** Builds the `Cookie` header to forward to the API, or undefined when not logged in. */
export function buildAuthCookieHeader(getValue: (name: AuthCookieName) => string | undefined): string | undefined {
  const pairs = AUTH_COOKIE_NAMES.flatMap((name) => {
    const value = getValue(name);
    return value ? [`${name}=${encodeURIComponent(value)}`] : [];
  });
  return pairs.length > 0 ? pairs.join("; ") : undefined;
}
