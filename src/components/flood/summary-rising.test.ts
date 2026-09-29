import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * "Rising" is a claim about movement. It used to count stations at watch or
 * warning — near the bank — so a gauge near its bank and falling was counted
 * as rising. It must come from measured trend.
 */
const bar = readFileSync("src/components/flood/SummaryBar.tsx", "utf8");

describe("the rising count", () => {
  it("comes from measured trend", () => {
    expect(bar).toMatch(/if \(p\.trend === "rising"\) rising\+\+/);
  });
  it("is never derived from status", () => {
    expect(bar).not.toMatch(/status === "watch"\)\s*rising\+\+/);
    expect(bar).not.toMatch(/"warning" \|\| p\.status === "watch"\) rising/);
  });
});
