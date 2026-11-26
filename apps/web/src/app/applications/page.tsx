import Link from "next/link";
import {
  ApplicationSchema,
  DueFollowUpSchema,
  TechStackOptionsSchema,
  UpcomingInterviewSchema,
} from "@job-tracker/types";
import { ApplicationFilters } from "@/components/application-filters";
import { DueFollowUps } from "@/components/due-follow-ups";
import { KanbanBoard } from "@/components/kanban-board";
import { UpcomingInterviews } from "@/components/upcoming-interviews";
import { buttonVariants } from "@/components/ui/button";
import { hasActiveFilters, parseFilters, toQueryString } from "@/lib/application-filters";
import { serverApiFetch } from "@/lib/session";

const UPCOMING_DAYS = 7;

// Links use prefetch={false}: see the refresh-token caveat in src/middleware.ts.
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const filtered = hasActiveFilters(filters);

  const [applications, upcomingInterviews, dueFollowUps, techOptions] = await Promise.all([
    serverApiFetch(`/applications${toQueryString(filters)}`, ApplicationSchema.array()),
    serverApiFetch(`/interviews/upcoming?days=${UPCOMING_DAYS}`, UpcomingInterviewSchema.array()),
    serverApiFetch("/follow-ups/due", DueFollowUpSchema.array()),
    serverApiFetch("/applications/tech-stack", TechStackOptionsSchema),
  ]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/applications/import" prefetch={false} className={buttonVariants({ variant: "outline" })}>
            Import CSV
          </Link>
          {applications.length > 0 && (
            // A plain <a>: it's a file download, not a page to navigate to client-side.
            <a href={`/applications/export${toQueryString(filters)}`} className={buttonVariants({ variant: "outline" })}>
              Export CSV
            </a>
          )}
          <Link href="/applications/new" prefetch={false} className={buttonVariants()}>
            New application
          </Link>
        </div>
      </div>

      <DueFollowUps followUps={dueFollowUps} />
      <UpcomingInterviews interviews={upcomingInterviews} days={UPCOMING_DAYS} />

      {applications.length === 0 && !filtered ? (
        <p className="text-muted-foreground">No applications yet. Add your first one.</p>
      ) : (
        <>
          {/* Keyed by the query so a Clear or back-navigation resets the uncontrolled inputs. */}
          <ApplicationFilters key={toQueryString(filters)} filters={filters} techOptions={techOptions} />
          {applications.length === 0 ? (
            <p className="text-muted-foreground">
              No applications match these filters.{" "}
              <Link href="/applications" prefetch={false} className="underline">
                Clear filters
              </Link>
            </p>
          ) : (
            <KanbanBoard applications={applications} />
          )}
        </>
      )}
    </>
  );
}
