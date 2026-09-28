import { describe, expect, it } from "vitest";
import type { MapFeature } from "../../lib/api/map-types.ts";
import { groupByRoad, passableForBand } from "./roads.ts";

/**
 * The Roads view answers "can I get through here". Everything it claims has to
 * be traceable to a report — we have no road geometry from any source, so the
 * failure mode to guard is the view inventing coverage it does not have.
 */
const at = "2026-09-28T03:00:00.000Z";

const report = (o: Partial<Record<string, unknown>> = {}): MapFeature =>
  ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [100.5, 13.75] },
    properties: {
      layer: "reports",
      provenance: "crowd",
      id: String(Math.random()),
      kind: "road",
      depthBand: 2,
      note: null,
      createdAt: at,
      expiresAt: at,
      opacity: 1,
      confidence: "confident",
      stillCount: 0,
      recededCount: 0,
      regionId: "th-10-bang-kapi",
      roadName: null,
      passableBy: null,
      ...o,
    },
  }) as MapFeature;

const station = (o: Partial<Record<string, unknown>> = {}): MapFeature =>
  ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [100.5, 13.75] },
    properties: {
      layer: "stations",
      provenance: "official_sensor",
      id: String(Math.random()),
      source: "thaiwater",
      kind: "canal_level",
      nameTh: null,
      nameEn: null,
      value: 2,
      bankLevelM: 1,
      status: "critical",
      observedAt: at,
      regionId: "th-10-bang-kapi",
      ...o,
    },
  }) as MapFeature;

describe("grouping by road", () => {
  it("groups by the road when a reporter named one", () => {
    const g = groupByRoad(
      [
        report({ roadName: "ซอยสุขุมวิท 39" }),
        report({ roadName: "ซอยสุขุมวิท 39" }),
      ],
      "th",
    );
    expect(g).toHaveLength(1);
    expect(g[0]!.name).toBe("ซอยสุขุมวิท 39");
    expect(g[0]!.named).toBe(true);
    expect(g[0]!.fromPeople).toBe(2);
  });

  it("falls back to the district, and says it is an area not a road", () => {
    const g = groupByRoad([report()], "th");
    expect(g[0]!.named).toBe(false);
    expect(g[0]!.name).toBe("เขตบางกะปิ");
  });

  it("keeps a named road separate from its district", () => {
    const g = groupByRoad(
      [report({ roadName: "ถนนพระราม 4" }), report()],
      "th",
    );
    expect(g.map((x) => x.named).sort()).toEqual([false, true]);
  });

  it("counts sensors and people apart, because they are different claims", () => {
    const g = groupByRoad([report(), report(), station()], "th");
    expect(g[0]!.fromPeople).toBe(2);
    expect(g[0]!.fromSensors).toBe(1);
  });

  it("leaves out a gauge that is reading normal", () => {
    // Otherwise a district joins a list of flooding because an instrument
    // there said everything is fine.
    expect(groupByRoad([station({ status: "normal" })], "th")).toHaveLength(0);
    expect(groupByRoad([station({ status: "unknown" })], "th")).toHaveLength(0);
    expect(groupByRoad([station({ status: "critical" })], "th")).toHaveLength(
      1,
    );
  });

  it("leaves out rain gauges — rainfall is not road passability", () => {
    expect(
      groupByRoad([station({ kind: "rain", status: "critical" })], "th"),
    ).toHaveLength(0);
  });

  it("takes the worst depth in the group, not the newest or the average", () => {
    const g = groupByRoad(
      [
        report({ roadName: "A", depthBand: 1 }),
        report({ roadName: "A", depthBand: 4 }),
        report({ roadName: "A", depthBand: 2 }),
      ],
      "th",
    );
    expect(g[0]!.worstBand).toBe(4);
  });

  it("sorts worst water first", () => {
    const g = groupByRoad(
      [
        report({ roadName: "shallow", depthBand: 1 }),
        report({ roadName: "deep", depthBand: 5 }),
      ],
      "th",
    );
    expect(g.map((x) => x.name)).toEqual(["deep", "shallow"]);
  });

  it("drops a datum it cannot place by name rather than guessing", () => {
    expect(groupByRoad([report({ regionId: null })], "th")).toHaveLength(0);
  });

  it("reports passability from the spec bands, never invented", () => {
    // A group is only as passable as its deepest point.
    expect(passableForBand(0)).toContain("motorbike");
    expect(passableForBand(4)).toEqual(["none"]);
    expect(passableForBand(null)).toEqual([]);
  });

  it("keeps what reporters observed separate from the band mapping", () => {
    const g = groupByRoad(
      [report({ roadName: "A", depthBand: 4, passableBy: ["pickup"] })],
      "th",
    );
    // The band says nothing passes; a reporter saw a pickup get through. Both
    // are shown, neither overwrites the other.
    expect(passableForBand(g[0]!.worstBand)).toEqual(["none"]);
    expect(g[0]!.observedPassable).toEqual(["pickup"]);
  });
});
