const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The only place `fetch` is called (CLAUDE.md: no raw fetch in components).
 * `credentials: "include"` matters only for browser calls; server-side calls
 * attach the auth cookies explicitly via `lib/session.ts`.
 *
 * Also returns the response's Set-Cookie lines, which login/register/refresh
 * need so the web app can re-issue the API's auth cookies on its own origin
 * (see lib/auth-cookies.ts for why).
 */
export async function apiFetchWithCookies<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; setCookies: string[] }> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }

  const setCookies = res.headers.getSetCookie();
  if (res.status === 204) {
    return { data: undefined as T, setCookies };
  }

  return { data: (await res.json()) as T, setCookies };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await apiFetchWithCookies<T>(path, init);
  return data;
}
