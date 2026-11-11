import { NextResponse, type NextRequest } from "next/server";
import { apiFetchWithCookies } from "@/lib/api-client";
import { authCookieOptions, parseAuthSetCookies } from "@/lib/auth-cookies";

/**
 * Refreshes the session for protected routes. The web-side access_token
 * cookie expires together with the API's JWT (same Max-Age), so a missing
 * access_token with a present refresh_token means "expired, refresh now".
 *
 * Refreshing has to happen here: server components can't set cookies.
 *
 * Caveat: the API treats a reused refresh token as theft and revokes every
 * session, so two concurrent refreshes with the same token log the user
 * out. Links into protected routes therefore use `prefetch={false}` to keep
 * it to one request per navigation.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.cookies.has("access_token")) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get("refresh_token")?.value;
  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { setCookies } = await apiFetchWithCookies<unknown>("/auth/refresh", {
      method: "POST",
      headers: { Cookie: `refresh_token=${encodeURIComponent(refreshToken)}` },
    });
    const cookies = parseAuthSetCookies(setCookies);

    // Also rewrite this request's cookies so the page rendering right now
    // already sees the new access token, not just the next request.
    for (const cookie of cookies) {
      request.cookies.set(cookie.name, cookie.value);
    }
    const response = NextResponse.next({ request: { headers: request.headers } });
    for (const cookie of cookies) {
      response.cookies.set(cookie.name, cookie.value, authCookieOptions(cookie.maxAge));
    }
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("refresh_token");
    return response;
  }
}

export const config = {
  matcher: ["/applications/:path*", "/settings/:path*"],
};
