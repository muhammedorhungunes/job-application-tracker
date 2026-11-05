/** 0.6667 -> "67%"; null (no denominator) -> "—". */
export function formatPercent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** "2026-11-02" -> "Nov 2". Week starts are UTC dates, so they're formatted in UTC. */
export function formatWeekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00.000Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

/** Bar length as a CSS percentage of the largest value; 0 when everything is 0. */
export function barPercent(value: number, max: number): number {
  return max === 0 ? 0 : (value / max) * 100;
}
