import { describe, expect, it } from "vitest";
import {
  confidenceOf,
  decayOpacity,
  hideAfterHours,
  initialExpiry,
  isExpired,
} from "./decay.ts";

const T0 = new Date("2026-09-26T00:00:00Z");
const at = (h: number): Date => new Date(T0.getTime() + h * 3_600_000);

describe("report lifetime", () => {
  it("keeps a report visible after its confident window instead of deleting it", () => {
    // A knee-deep report is confident for 12 h, then unconfirmed — not gone.
    expect(confidenceOf(T0, "road", 3, at(6))).toBe("confident");
    expect(confidenceOf(T0, "road", 3, at(13))).toBe("unconfirmed");
    expect(decayOpacity(T0, "road", at(13), 3)).toBeGreaterThan(0);
  });

  it("gives deeper water a longer life, because hiding it costs more", () => {
    expect(hideAfterHours("road", 1)).toBeLessThan(hideAfterHours("road", 5));
    expect(confidenceOf(T0, "road", 1, at(8))).toBe("unconfirmed");
    expect(confidenceOf(T0, "road", 5, at(8))).toBe("confident");
  });

  it("lets an official gauge nearby stand in for a human confirmation", () => {
    // Corroborated reports stay confident twice as long.
    expect(confidenceOf(T0, "road", 3, at(18), false)).toBe("unconfirmed");
    expect(confidenceOf(T0, "road", 3, at(18), true)).toBe("confident");
  });

  it("outlives everything for a help report", () => {
    expect(confidenceOf(T0, "help", 0, at(23))).toBe("confident");
    expect(confidenceOf(T0, "help", 0, at(48))).toBe("unconfirmed");
    expect(hideAfterHours("help", 0)).toBe(96);
  });

  it("eventually stops showing a report nobody ever confirmed", () => {
    const gone = hideAfterHours("road", 3);
    expect(confidenceOf(T0, "road", 3, at(gone))).toBe("gone");
    expect(decayOpacity(T0, "road", at(gone), 3)).toBe(0);
  });

  it("never fades a report to invisibility while it is still shown", () => {
    for (let h = 0; h < hideAfterHours("road", 3); h += 0.5) {
      expect(decayOpacity(T0, "road", at(h), 3)).toBeGreaterThan(0.25);
    }
  });

  it("sets expiry to the hide point, not the confident point", () => {
    const e = initialExpiry("road", T0, 3);
    expect(isExpired(e, at(13))).toBe(false);
    expect(isExpired(e, at(hideAfterHours("road", 3)))).toBe(true);
  });
});
