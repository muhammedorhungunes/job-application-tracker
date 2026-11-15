import { parseFilters, toQueryString } from "@/lib/application-filters";
import { serverApiFetchText } from "@/lib/session";

/**
 * Proxies GET /applications/export. The browser can't call the API directly:
 * the auth cookies live on the web origin (see lib/auth-cookies.ts). Being
 * under /applications, the middleware refreshes an expired session first.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const searchParams: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    searchParams[key] = values.length === 1 ? values[0] : values;
  }
  // Same normalisation as the board, so a stale or hand-edited URL still downloads.
  const query = toQueryString(parseFilters(searchParams));

  const csv = await serverApiFetchText(`/applications/export${query}`);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applications-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
