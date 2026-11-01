"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import type { Application } from "@job-tracker/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const cardClassName = "block rounded-md border border-border bg-background p-3 text-sm shadow-sm";

function CardContent({ application }: { application: Application }) {
  return (
    <>
      <p className="font-medium">{application.position}</p>
      <p className="text-muted-foreground">{application.company.name}</p>
      <p className="mt-2 text-xs text-muted-foreground">{formatDate(application.appliedAt)}</p>
    </>
  );
}

// The card stays in place while dragging; the board's DragOverlay renders the
// moving copy, so it isn't clipped by the horizontally scrolling container.
// prefetch={false}: see the refresh-token caveat in src/middleware.ts.
// dnd-kit swallows the click that ends a drag, so dropping a card doesn't also open it.
export function KanbanCard({ application }: { application: Application }) {
  // dnd-kit defaults to role="button"; keep the card announced as the link it is.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: application.id,
    attributes: { role: "link" },
  });

  return (
    <Link
      ref={setNodeRef}
      href={`/applications/${application.id}`}
      prefetch={false}
      {...listeners}
      {...attributes}
      className={cn(cardClassName, "touch-none hover:bg-muted", isDragging && "opacity-40")}
    >
      <CardContent application={application} />
    </Link>
  );
}

export function KanbanCardPreview({ application }: { application: Application }) {
  return (
    <div className={cn(cardClassName, "cursor-grabbing shadow-lg")}>
      <CardContent application={application} />
    </div>
  );
}
