/**
 * Parses a simple "<amount><unit>" duration string (e.g. "15m", "30d") into
 * milliseconds. Deliberately minimal — only supports single-unit durations,
 * matching the JWT_*_TTL env vars. Extend if a more complex format is
 * ever needed.
 */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Unsupported duration format: "${duration}" (expected e.g. "15m", "30d")`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60_000;
    case "h":
      return amount * 3_600_000;
    case "d":
      return amount * 86_400_000;
    default:
      throw new Error(`Unsupported duration unit: "${unit}"`);
  }
}

export function parseDurationSeconds(duration: string): number {
  return Math.floor(parseDurationMs(duration) / 1000);
}

export function addDuration(from: Date, duration: string): Date {
  return new Date(from.getTime() + parseDurationMs(duration));
}
