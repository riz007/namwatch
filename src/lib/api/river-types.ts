import type { BasinDam, RiverGauge } from "@/config/river.ts";
import type { Trend } from "@/lib/trend.ts";

/** Shape of `GET /api/v1/river`, shared by the route and the client. */
export type RiverGaugeState = RiverGauge & {
  nameTh: string | null;
  nameEn: string | null;
  valueM: number | null;
  bankLevelM: number | null;
  /** Metres below the bank; negative means over it. */
  freeboardM: number | null;
  status: "normal" | "watch" | "warning" | "critical" | "unknown";
  dischargeM3s: number | null;
  trend: Trend | null;
  deltaM: number | null;
  observedAt: string | null;
};

export type RiverDamState = BasinDam & {
  nameTh: string | null;
  nameEn: string | null;
  storagePct: number | null;
  storageMcm: number | null;
  maxStorageMcm: number | null;
  inflowMcm: number | null;
  releasedMcm: number | null;
  spilledMcm: number | null;
  observedOn: string | null;
};

export type RiverResponse = {
  gauges: RiverGaugeState[];
  dams: RiverDamState[];
  meta: { generatedAt: string; degraded: string[] };
};
