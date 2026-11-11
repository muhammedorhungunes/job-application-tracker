import { ApplicationListQuerySchema, type ApplicationListQuery } from "@job-tracker/types";

type SearchParams = Record<string, string | string[] | undefined>;

const FILTER_KEYS = ["q", "status", "tech", "from", "to"] as const satisfies readonly (keyof ApplicationListQuery)[];

/**
 * Parses the board page's URL search params. A hand-edited or stale URL
 * shouldn't break the page, so invalid fields are dropped and the valid ones
 * are kept (`?status=NOPE&q=acme` still searches for "acme").
 */
export function parseFilters(searchParams: SearchParams): ApplicationListQuery {
  const input: Partial<Record<(typeof FILTER_KEYS)[number], unknown>> = {};
  for (const key of FILTER_KEYS) {
    if (searchParams[key] !== undefined) input[key] = searchParams[key];
  }

  const first = ApplicationListQuerySchema.safeParse(input);
  if (first.success) return first.data;

  for (const issue of first.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && key in input) delete input[key as keyof typeof input];
  }
  const second = ApplicationListQuerySchema.safeParse(input);
  return second.success ? second.data : {};
}

/** Query string for GET /applications (and the board URL); statuses become repeated keys. */
export function toQueryString(filters: ApplicationListQuery): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const status of filters.status ?? []) params.append("status", status);
  if (filters.tech) params.set("tech", filters.tech);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasActiveFilters(filters: ApplicationListQuery): boolean {
  return toQueryString(filters) !== "";
}
