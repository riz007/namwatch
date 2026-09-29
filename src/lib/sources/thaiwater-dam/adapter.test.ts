import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeDams } from "./normalize.ts";

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/thailand-main-dam.json", import.meta.url),
    "utf8",
  ),
) as unknown;

describe("thaiwater-dam normalize", () => {
  const { dams = [] } = normalizeDams(fixture);

  it("reads every large dam in the national summary", () => {
    expect(dams).toHaveLength(35);
  });

  it("keeps the Chao Phraya basin dams, bilingual", () => {
    const byId = new Map(dams.map((d) => [d.externalId, d]));
    expect(byId.get("1")?.nameEn).toBe("Bhumibol");
    expect(byId.get("12")?.nameTh).toBe("สิริกิติ์");
    expect(byId.get("11")?.nameTh).toBe("ป่าสักชลสิทธิ์");
    expect(byId.get("36")?.nameTh).toBe("แควน้อยบำรุงแดน");
  });

  it("keeps storage above 100 % as published rather than clamping it", () => {
    // Pa Sak read 102.27 % in the sample. Clamping to 100 would hide the one
    // fact that matters: it is over capacity and has to release.
    const paSak = dams.find((d) => d.externalId === "11");
    expect(paSak?.storagePct).toBeCloseTo(102.27, 2);
  });

  it("parses numeric strings and dates without inventing values", () => {
    for (const d of dams) {
      expect(d.observedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(d.point.lon)).toBe(true);
      expect(Number.isFinite(d.point.lat)).toBe(true);
    }
  });

  it("drops a row with no usable position instead of guessing", () => {
    const bad = structuredClone(fixture) as {
      dam: { data: { data: { dam: { dam_lat: unknown } }[] } };
    };
    bad.dam.data.data[0]!.dam.dam_lat = null;
    expect(normalizeDams(bad).dams).toHaveLength(34);
  });

  it("rejects a payload of the wrong shape rather than half-reading it", () => {
    expect(() => normalizeDams({ nope: true })).toThrow();
  });
});
