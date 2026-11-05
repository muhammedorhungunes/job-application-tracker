import { describe, expect, it } from "vitest";
import { barPercent, formatPercent, formatWeekLabel } from "./stats";

describe("formatPercent", () => {
  it("rounds to a whole percent", () => {
    expect(formatPercent(2 / 3)).toBe("67%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("shows a dash when there's no rate", () => {
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatWeekLabel", () => {
  it("formats the week start in UTC", () => {
    expect(formatWeekLabel("2026-11-02")).toBe("Nov 2");
  });
});

describe("barPercent", () => {
  it("scales against the max", () => {
    expect(barPercent(2, 4)).toBe(50);
  });

  it("returns 0 when the max is 0", () => {
    expect(barPercent(0, 0)).toBe(0);
  });
});
