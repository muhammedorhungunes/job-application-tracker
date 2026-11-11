import { localDate, localHour } from "./time-zone";

describe("localHour / localDate", () => {
  const at = new Date("2026-11-12T06:00:00.000Z");

  it("converts to the zone's wall clock", () => {
    expect(localHour(at, "Europe/Istanbul")).toBe(9);
    expect(localHour(at, "UTC")).toBe(6);
    expect(localHour(at, "America/New_York")).toBe(1);
    expect(localDate(at, "Europe/Istanbul")).toBe("2026-11-12");
  });

  it("reports midnight as 0, not 24", () => {
    expect(localHour(new Date("2026-11-12T00:00:00.000Z"), "UTC")).toBe(0);
  });

  it("handles half-hour offsets", () => {
    // India is UTC+5:30, so a scan on the hour lands at :30 local time.
    expect(localHour(new Date("2026-11-12T03:00:00.000Z"), "Asia/Kolkata")).toBe(8);
    expect(localHour(new Date("2026-11-12T04:00:00.000Z"), "Asia/Kolkata")).toBe(9);
  });

  it("uses the local calendar day across the date line", () => {
    expect(localDate(at, "Pacific/Kiritimati")).toBe("2026-11-12"); // UTC+14
    expect(localDate(at, "Pacific/Pago_Pago")).toBe("2026-11-11"); // UTC-11
  });

  it("follows daylight saving", () => {
    // New York: UTC-4 in summer, UTC-5 in winter.
    expect(localHour(new Date("2026-07-01T13:00:00.000Z"), "America/New_York")).toBe(9);
    expect(localHour(new Date("2026-12-01T14:00:00.000Z"), "America/New_York")).toBe(9);
  });
});
