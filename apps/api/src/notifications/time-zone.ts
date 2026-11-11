/** Hour of day (0-23) at `date` in `timeZone`. */
export function localHour(date: Date, timeZone: string): number {
  // h23, not hour12: false: the latter can render midnight as "24".
  const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  return Number(hour);
}

/** Calendar day (YYYY-MM-DD) at `date` in `timeZone`. */
export function localDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
