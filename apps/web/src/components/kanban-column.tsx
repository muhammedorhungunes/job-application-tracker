"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Application, ApplicationStatus } from "@job-tracker/types";
import { KanbanCard } from "@/components/kanban-card";
import { formatStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export function KanbanColumn({ status, applications }: { status: ApplicationStatus; applications: Application[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `kanban-column-${status}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        "flex w-60 shrink-0 flex-col gap-2 rounded-md border border-border bg-muted/50 p-2",
        isOver && "border-foreground/40 bg-muted",
      )}
    >
      <h2 id={headingId} className="flex items-center justify-between px-1 text-sm font-semibold">
        {formatStatus(status)}
        <span className="text-xs font-normal text-muted-foreground">{applications.length}</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {applications.map((application) => (
          <li key={application.id}>
            <KanbanCard application={application} />
          </li>
        ))}
      </ul>
    </section>
  );
}
