import { describe, expect, it } from "vitest";
import {
  distanceMeters,
  isCorroborated,
  shouldAutoHide,
  shouldExpireFromVotes,
} from "./trust.ts";

const counts = (still: number, receded: number, flags: number) => ({
  still,
  receded,
  flags,
});

describe("trust (SPEC §6.2)", () => {
  it("auto-hides on three distinct flags", () => {
    expect(shouldAutoHide(counts(0, 0, 2))).toBe(false);
    expect(shouldAutoHide(counts(0, 0, 3))).toBe(true);
  });

  it("needs two receded votes to retire a report", () => {
    expect(shouldExpireFromVotes(counts(0, 1, 0))).toBe(false);
    expect(shouldExpireFromVotes(counts(0, 2, 0))).toBe(true);
  });

  it("does not let a minority of receded votes override people saying it is still flooded", () => {
    expect(shouldExpireFromVotes(counts(5, 2, 0))).toBe(false);
    expect(shouldExpireFromVotes(counts(1, 3, 0))).toBe(true);
  });

  it("measures distance accurately enough for a 500 m radius", () => {
    // One degree of latitude is ~111 km.
    const a = { lon: 100.5, lat: 13.75 };
    const b = { lon: 100.5, lat: 13.759 };
    expect(distanceMeters(a, b)).toBeGreaterThan(980);
    expect(distanceMeters(a, b)).toBeLessThan(1020);
    expect(distanceMeters(a, a)).toBe(0);
  });

  it("corroborates only against a nearby station that is actually flooding", () => {
    const report = { lon: 100.5918, lat: 13.8271 };
    const near = { lon: 100.5928, lat: 13.8275 };
    const far = { lon: 100.65, lat: 13.9 };

    expect(isCorroborated(report, [{ point: near, status: "critical" }])).toBe(
      true,
    );
    expect(isCorroborated(report, [{ point: near, status: "warning" }])).toBe(
      true,
    );
    // "watch" means rising, not flooding — it must not earn the badge.
    expect(isCorroborated(report, [{ point: near, status: "watch" }])).toBe(
      false,
    );
    expect(isCorroborated(report, [{ point: near, status: "normal" }])).toBe(
      false,
    );
    expect(isCorroborated(report, [{ point: far, status: "critical" }])).toBe(
      false,
    );
    expect(isCorroborated(report, [])).toBe(false);
  });
});
