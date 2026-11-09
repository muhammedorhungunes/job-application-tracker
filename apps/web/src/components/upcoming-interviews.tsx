import Link from "next/link";
import type { UpcomingInterview } from "@job-tracker/types";
import { LocalDateTime } from "@/components/local-date-time";
import { formatInterviewKind } from "@/lib/interview";

/** Server component; renders nothing when the window is empty so the board isn't pushed down for no reason. */
export function UpcomingInterviews({ interviews, days }: { interviews: UpcomingInterview[]; days: number }) {
  if (interviews.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="font-medium">Upcoming interviews</h2>
      <p className="-mt-2 text-xs text-muted-foreground">Next {days} days</p>
      <ul aria-label="Upcoming interviews" className="flex flex-col divide-y divide-border">
        {interviews.map((interview) => (
          <li key={interview.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
            <Link
              href={`/applications/${interview.application.id}`}
              prefetch={false}
              className="min-w-0 hover:underline"
            >
              <span className="font-medium">{formatInterviewKind(interview.kind)}</span>
              {" · "}
              {interview.application.company.name}
              <span className="text-muted-foreground"> — {interview.application.position}</span>
            </Link>
            <span className="shrink-0 text-muted-foreground">
              <LocalDateTime iso={interview.scheduledAt} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
