import { BANGKOK_BBOX } from "@/config/app.config.ts";
import { describe, expect, it } from "vitest";
import { distanceMeters } from "../reports/trust.ts";
import { InvalidBBoxError, clampSpan, contains, parseBBox } from "./bbox.ts";
import {
  h3IndexFor,
  publicLocation,
  shouldBlur,
  snapToCellCentre,
} from "./h3.ts";
import { resolveRegionId } from "./region.ts";

describe("bbox", () => {
  it("defaults to Bangkok when absent", () => {
    expect(parseBBox(null)).toEqual(BANGKOK_BBOX);
    expect(parseBBox("")).toEqual(BANGKOK_BBOX);
  });

  it("parses a valid bbox", () => {
    expect(parseBBox("100.4,13.6,100.7,13.9")).toEqual([
      100.4, 13.6, 100.7, 13.9,
    ]);
  });

  it("rejects malformed input rather than guessing", () => {
    for (const bad of [
      "1,2,3",
      "a,b,c,d",
      "100,13,100,14",
      "100,13,101,13",
      "200,13,201,14",
    ]) {
      expect(() => parseBBox(bad), bad).toThrow(InvalidBBoxError);
    }
  });

  // Hard rule 11: no unbounded selects.
  it("clamps an over-wide bbox around its centre instead of erroring", () => {
    const clamped = parseBBox("-180,-90,180,90");
    const [w, s, e, n] = clamped;
    expect(e - w).toBeLessThanOrEqual(3);
    expect(n - s).toBeLessThanOrEqual(3);
    expect((w + e) / 2).toBeCloseTo(0, 6);
  });

  it("leaves a reasonable bbox untouched", () => {
    const bbox = [100.4, 13.6, 100.7, 13.9] as const;
    expect(clampSpan(bbox)).toEqual(bbox);
  });

  it("tests containment", () => {
    expect(contains(BANGKOK_BBOX, 100.5918, 13.8271)).toBe(true);
    expect(contains(BANGKOK_BBOX, 98.0, 18.8)).toBe(false);
  });
});

describe("h3 privacy snapping (SPEC §6.3, Hard rule 10)", () => {
  const home = { lon: 100.5918, lat: 13.8271 };

  it("blurs only home and help reports", () => {
    expect(shouldBlur("home")).toBe(true);
    expect(shouldBlur("help")).toBe(true);
    expect(shouldBlur("road")).toBe(false);
    expect(shouldBlur("canal")).toBe(false);
  });

  it("moves a home report off its exact point", () => {
    const { exact, publicPoint } = publicLocation(home, "home");
    expect(exact).toEqual(home);
    expect(publicPoint).not.toEqual(home);
    // An r9 cell is ~170 m across, so the centre is within ~200 m of any point in it.
    expect(distanceMeters(home, publicPoint)).toBeLessThan(200);
    expect(distanceMeters(home, publicPoint)).toBeGreaterThan(0);
  });

  it("keeps road and canal reports exact — a blurred road closure is useless", () => {
    expect(publicLocation(home, "road").publicPoint).toEqual(home);
    expect(publicLocation(home, "canal").publicPoint).toEqual(home);
  });

  it("maps every point in a cell to the same public point, so homes are not distinguishable", () => {
    const neighbour = { lon: home.lon + 0.0002, lat: home.lat + 0.0002 };
    expect(h3IndexFor(neighbour)).toBe(h3IndexFor(home));
    expect(snapToCellCentre(neighbour)).toEqual(snapToCellCentre(home));
  });

  it("produces a resolution-9 index", () => {
    expect(h3IndexFor(home)).toMatch(/^89/);
  });
});

describe("region resolution", () => {
  it("resolves Thai district names, with or without the เขต prefix", () => {
    expect(resolveRegionId("คลองสามวา")).toBe("th-10-khlong-sam-wa");
    expect(resolveRegionId("เขตบางกะปิ")).toBe("th-10-bang-kapi");
    expect(resolveRegionId("  ลาดกระบัง  ")).toBe("th-10-lat-krabang");
  });

  it("returns null for an unknown or missing district rather than guessing", () => {
    expect(resolveRegionId("เมืองเชียงใหม่")).toBeNull();
    expect(resolveRegionId(null)).toBeNull();
    expect(resolveRegionId("")).toBeNull();
  });
});
