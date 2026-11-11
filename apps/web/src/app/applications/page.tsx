import Link from "next/link";
import { ApplicationSchema, TechStackOptionsSchema, UpcomingInterviewSchema } from "@job-tracker/types";
import { ApplicationFilters } from "@/components/application-filters";
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

  const [applications, upcomingInterviews, techOptions] = await Promise.all([
    serverApiFetch(`/applications${toQueryString(filters)}`, ApplicationSchema.array()),
    serverApiFetch(`/interviews/upcoming?days=${UPCOMING_DAYS}`, UpcomingInterviewSchema.array()),
    serverApiFetch("/applications/tech-stack", TechStackOptionsSchema),
  ]);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <Link href="/applications/new" prefetch={false} className={buttonVariants()}>
          New application
        </Link>
      </div>

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
