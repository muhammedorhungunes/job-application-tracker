/** `@db.Date` columns round-trip as UTC midnight, so the calendar day is the ISO date part. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromDateOnly(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
