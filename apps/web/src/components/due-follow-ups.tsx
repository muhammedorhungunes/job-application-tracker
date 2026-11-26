import Link from "next/link";
import type { DueFollowUp } from "@job-tracker/types";
import { formatDate } from "@/lib/format";

/** Server component; renders nothing when nothing is due so the board isn't pushed down for no reason. */
export function DueFollowUps({ followUps }: { followUps: DueFollowUp[] }) {
  if (followUps.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-medium">Follow-ups due</h2>
      <ul aria-label="Follow-ups due" className="flex flex-col divide-y divide-border">
        {followUps.map((followUp) => (
          <li key={followUp.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
            <Link href={`/applications/${followUp.application.id}`} prefetch={false} className="min-w-0 hover:underline">
              <span className="font-medium">{followUp.note}</span>
              {" · "}
              {followUp.application.company.name}
              <span className="text-muted-foreground"> — {followUp.application.position}</span>
              {followUp.contact && <span className="text-muted-foreground"> (with {followUp.contact.name})</span>}
            </Link>
            {/* Oldest first; everything listed is due today or overdue in the user's time zone. */}
            <span className="shrink-0 text-muted-foreground">Due {formatDate(followUp.dueDate)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
