import { ApiError } from "@/lib/api-client";
import { serverApiFetchText } from "@/lib/session";

/**
 * Fetches an .ics file from the API and hands it to the browser as a
 * download. Route handlers proxy it because the auth cookies live on the web
 * origin (see lib/auth-cookies.ts); being under /applications, the middleware
 * refreshes an expired session first. A cancelled or foreign interview is a
 * plain 404.
 */
export async function calendarDownload(apiPath: string, filename: string): Promise<Response> {
  try {
    const ics = await serverApiFetchText(apiPath);
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return new Response("Not found", { status: 404 });
    throw error;
  }
}
