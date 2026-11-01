import { ApplicationStatusValues, type Application, type ApplicationStatus } from "@job-tracker/types";

export type KanbanColumns = Record<ApplicationStatus, Application[]>;

/** One column per status, in enum order, including empty ones. Most recently updated first. */
export function groupByStatus(applications: Application[]): KanbanColumns {
  const columns = {} as KanbanColumns;
  for (const status of ApplicationStatusValues) {
    columns[status] = [];
  }
  for (const application of applications) {
    columns[application.status].push(application);
  }
  for (const status of ApplicationStatusValues) {
    columns[status].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return columns;
}

/**
 * Optimistic version of a status change. `updatedAt` is bumped so the moved
 * card lands at the top of its new column, matching what the server returns.
 */
export function moveApplication(
  applications: Application[],
  id: string,
  status: ApplicationStatus,
  now: string = new Date().toISOString(),
): Application[] {
  return applications.map((application) =>
    application.id === id && application.status !== status ? { ...application, status, updatedAt: now } : application,
  );
}
