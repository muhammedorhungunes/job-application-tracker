import { ApplicationStatusValues, type ApplicationStats } from "@job-tracker/types";
import { formatStatus } from "@/lib/format";
import { barPercent } from "@/lib/stats";

/** Horizontal bars, one per status. Plain HTML: every bar is labeled, so no legend or axis is needed. */
export function StatusBarChart({ byStatus }: { byStatus: ApplicationStats["byStatus"] }) {
  const max = Math.max(...Object.values(byStatus));

  return (
    <ul className="flex flex-col gap-3" aria-label="Applications by status">
      {ApplicationStatusValues.map((status) => {
        const count = byStatus[status];
        return (
          <li key={status} className="grid grid-cols-[7rem_1fr] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{formatStatus(status)}</span>
            <div className="flex items-center gap-2" title={`${formatStatus(status)}: ${count}`}>
              {count > 0 ? (
                <div
                  data-testid={`status-bar-${status}`}
                  // 4px rounded data-end, square at the baseline.
                  className="h-4 min-w-1 rounded-r bg-chart-1"
                  style={{ width: `${barPercent(count, max)}%` }}
                />
              ) : null}
              <span className="tabular-nums">{count}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
