import Link from "next/link";
import { ApplicationSchema } from "@job-tracker/types";
import { KanbanBoard } from "@/components/kanban-board";
import { buttonVariants } from "@/components/ui/button";
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
        <KanbanBoard applications={applications} />
      )}
    </>
  );
}
