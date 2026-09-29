import { describe, expect, it } from "vitest";
import { CHAO_PHRAYA_DAMS, CHAO_PHRAYA_GAUGES } from "../../config/river.ts";
import type {
  RiverDamState,
  RiverGaugeState,
} from "../../lib/api/river-types.ts";
import {
  MAX_WIDTH_PX,
  MIN_WIDTH_PX,
  riverRows,
  widthForFlow,
} from "./layout.ts";

/** Flow as read on 29 Sep 2026; null where the gauge is level-only. */
const FLOW: Record<string, number | null> = {
  "C.2": 2155,
  "C.13": 2000,
  "C.3": 2157,
  "C.7A": 2063,
  "C.35": 1316,
  CPY012: null,
  CPY014: null,
  "C.12": null,
  CPY015: null,
};

const gauges: RiverGaugeState[] = CHAO_PHRAYA_GAUGES.map((g) => ({
  ...g,
  nameTh: null,
  nameEn: null,
  valueM: 1,
  bankLevelM: 2,
  freeboardM: 1,
  status: "normal",
  dischargeM3s: FLOW[g.code] ?? null,
  trend: null,
  deltaM: null,
  observedAt: null,
}));
const dams: RiverDamState[] = CHAO_PHRAYA_DAMS.map((d) => ({
  ...d,
  nameTh: null,
  nameEn: null,
  storagePct: 80,
  storageMcm: null,
  maxStorageMcm: null,
  inflowMcm: null,
  releasedMcm: null,
  spilledMcm: null,
  observedOn: null,
}));

describe("river layout", () => {
  const rows = riverRows(gauges, dams);
  const gaugeRows = rows.filter((r) => r.kind === "gauge");

  it("keeps every gauge, in river order", () => {
    expect(gaugeRows.map((r) => r.gauge.code)).toEqual(
      CHAO_PHRAYA_GAUGES.map((g) => g.code),
    );
  });

  it("scales width with measured flow, within bounds", () => {
    expect(widthForFlow(0)).toBe(MIN_WIDTH_PX);
    expect(widthForFlow(10_000)).toBe(MAX_WIDTH_PX);
    expect(widthForFlow(2155)).toBeGreaterThan(widthForFlow(1316));
  });

  it("marks the river unmeasured below the last flow-rated gauge", () => {
    const measured = Object.fromEntries(
      gaugeRows.map((r) => [r.gauge.code, r.measured]),
    );
    expect(measured["C.35"]).toBe(true);
    expect(measured["CPY012"]).toBe(false);
    expect(measured["CPY015"]).toBe(false);
  });

  it("brings each dam in where its river actually joins", () => {
    const order = rows.map((r) =>
      r.kind === "inlet" ? r.dams.map((d) => d.id).join("+") : r.gauge.code,
    );
    // Ping, Nan and Khwae Noi dams before Nakhon Sawan; Pa Sak before Ayutthaya,
    // i.e. below the Chao Phraya Dam — the reason its storage matters.
    expect(
      order.indexOf("thaiwater-dam:1+thaiwater-dam:12+thaiwater-dam:36"),
    ).toBe(0);
    expect(order.indexOf("thaiwater-dam:11")).toBe(order.indexOf("C.35") - 1);
    expect(order.indexOf("thaiwater-dam:11")).toBeGreaterThan(
      order.indexOf("C.13"),
    );
  });

  it("starts the river at the first confluence", () => {
    const first = rows[0]!;
    expect(first.kind === "inlet" && first.head).toBe(true);
  });
});
