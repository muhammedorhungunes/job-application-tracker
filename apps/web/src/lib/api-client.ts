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
async function request(path: string, init?: RequestInit): Promise<Response> {
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
  return res;
}

export async function apiFetchWithCookies<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; setCookies: string[] }> {
  const res = await request(path, init);
  const setCookies = res.headers.getSetCookie();
  if (res.status === 204) {
    return { data: undefined as T, setCookies };
  }

  return { data: (await res.json()) as T, setCookies };
}

/**
 * For non-JSON responses such as the CSV export. Decoded by hand because
 * `res.text()` strips a UTF-8 BOM, which Excel needs to read the CSV as UTF-8.
 */
export async function apiFetchText(path: string, init?: RequestInit): Promise<string> {
  const res = await request(path, init);
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await res.arrayBuffer());
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await apiFetchWithCookies<T>(path, init);
  return data;
}
