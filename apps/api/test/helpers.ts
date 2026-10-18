/** Extracts a single cookie's `name=value` pair from a Set-Cookie header list. */
export function pickCookie(setCookieHeader: string | string[] | undefined, name: string): string {
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const header = headers.find((c) => c.startsWith(`${name}=`));
  if (!header) {
    throw new Error(`Expected a "${name}" cookie in the response`);
  }
  return header.split(";")[0]!;
}
