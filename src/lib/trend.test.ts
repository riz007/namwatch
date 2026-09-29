import { describe, expect, it } from "vitest";
import { trendOf } from "./trend.ts";

describe("trend from our own readings", () => {
  it("calls 3 cm or more over two hours a rise or a fall", () => {
    expect(trendOf(2.05, 2.0, "canal_level")).toEqual({
      trend: "rising",
      deltaM: 0.05,
    });
    expect(trendOf(1.9, 2.0, "canal_level")).toEqual({
      trend: "falling",
      deltaM: -0.1,
    });
  });

  it("treats anything under 3 cm as steady — gauges report to the centimetre", () => {
    expect(trendOf(2.02, 2.0, "canal_level").trend).toBe("steady");
  });

  it("claims nothing without a fair comparison point", () => {
    expect(trendOf(2.0, null, "canal_level")).toEqual({
      trend: null,
      deltaM: null,
    });
    expect(trendOf(null, 2.0, "canal_level").trend).toBeNull();
  });

  it("never gives rainfall a trend: it is an accumulation, not a level", () => {
    expect(trendOf(40, 10, "rain").trend).toBeNull();
  });
});
