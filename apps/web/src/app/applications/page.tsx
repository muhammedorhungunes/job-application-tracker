import Link from "next/link";
import { ApplicationSchema } from "@job-tracker/types";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatStatus } from "@/lib/format";
import { serverApiFetch } from "@/lib/session";

// Links use prefetch={false}: see the refresh-token caveat in src/middleware.ts.
export default async function ApplicationsPage() {
  const applications = await serverApiFetch("/applications", ApplicationSchema.array());

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <Link href="/applications/new" prefetch={false} className={buttonVariants()}>
          New application
        </Link>
      </div>

      {applications.length === 0 ? (
        <p className="text-muted-foreground">No applications yet. Add your first one.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {applications.map((application) => (
            <li key={application.id}>
              <Link
                href={`/applications/${application.id}`}
                prefetch={false}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted"
              >
                <div>
                  <p className="font-medium">{application.position}</p>
                  <p className="text-sm text-muted-foreground">{application.company.name}</p>
                </div>
                <div className="text-right text-sm">
                  <p>{formatStatus(application.status)}</p>
                  <p className="text-muted-foreground">{formatDate(application.appliedAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
