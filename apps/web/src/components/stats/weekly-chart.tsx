import type { ApplicationStats } from "@job-tracker/types";
import { barPercent, formatWeekLabel } from "@/lib/stats";

/**
 * Column chart of applications per week, built from flex divs rather than
 * SVG so it reflows to phone width without scaling its text. Hover detail
 * comes from native `title` tooltips (it's a server component, no JS), and a
 * visually hidden table carries every value for screen readers.
 */
export function WeeklyChart({ weekly }: { weekly: ApplicationStats["weekly"] }) {
  const max = Math.max(0, ...weekly.map((w) => w.count));
  const lastIndex = weekly.length - 1;

  return (
    <figure className="flex flex-col gap-2">
      {/* pt-5 reserves room above the tallest column for its cap label. */}
      <div className="flex h-44 items-end gap-0.5 border-b border-border pt-5" aria-hidden="true">
        {weekly.map((week, i) => {
          const height = barPercent(week.count, max);
          return (
            <div
              key={week.weekStart}
              className="relative flex h-full flex-1 items-end justify-center"
              title={`Week of ${formatWeekLabel(week.weekStart)}: ${week.count}`}
            >
              {week.count > 0 ? (
                <div
                  data-testid="weekly-column"
                  className="w-full max-w-6 rounded-t bg-chart-1"
                  style={{ height: `${height}%` }}
                />
              ) : null}
              {/* Value on the cap only for the peak and the current week — not on every column. */}
              {week.count > 0 && (week.count === max || i === lastIndex) ? (
                <span
                  className="absolute text-xs tabular-nums text-muted-foreground"
                  style={{ bottom: `calc(${height}% + 2px)` }}
                >
                  {week.count}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{weekly[0] ? formatWeekLabel(weekly[0].weekStart) : null}</span>
        <span>This week</span>
      </div>

      <table className="sr-only">
        <caption>Applications per week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Applications</th>
          </tr>
        </thead>
        <tbody>
          {weekly.map((week) => (
            <tr key={week.weekStart}>
              <td>{formatWeekLabel(week.weekStart)}</td>
              <td>{week.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
