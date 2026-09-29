import { CHAO_PHRAYA_DAMS, CHAO_PHRAYA_GAUGES } from "@/config/river.ts";
import { apiError } from "@/lib/api/respond.ts";
import type { RiverResponse } from "@/lib/api/river-types.ts";
import { isDatabaseConfigured } from "@/lib/db/index.ts";
import { stationsByExternalId } from "@/lib/db/queries/map.ts";
import { damsById } from "@/lib/db/queries/river.ts";
import { log } from "@/lib/log.ts";
import { trendOf } from "@/lib/trend.ts";
import { NextResponse } from "next/server";

/**
 * `GET /api/v1/river` — the upstream picture: Chao Phraya gauges north to
 * south, and the basin dams that feed them.
 *
 * Gauges and dams load independently; either failing degrades only its half
 * (hard rule 5), and the response says which.
 */
export const dynamic = "force-dynamic";

const num = (v: string | null): number | null =>
  v === null ? null : Number(v);

export async function GET() {
  if (!isDatabaseConfigured()) return apiError("unavailable");
  const degraded: string[] = [];

  const [stationRows, damRows] = await Promise.all([
    stationsByExternalId(
      "thaiwater",
      CHAO_PHRAYA_GAUGES.map((g) => g.externalId),
    ).catch((error: unknown) => {
      degraded.push("gauges");
      log.warn({ err: String(error) }, "river gauges failed");
      return [];
    }),
    damsById(CHAO_PHRAYA_DAMS.map((d) => d.id)).catch((error: unknown) => {
      degraded.push("dams");
      log.warn({ err: String(error) }, "river dams failed");
      return [];
    }),
  ]);

  const byExternal = new Map(stationRows.map((s) => [s.externalId, s]));
  const damById = new Map(damRows.map((d) => [d.id, d]));

  const body: RiverResponse = {
    // Config order is river order. A gauge missing from the feed still gets a
    // node, marked as having no reading, so the river never silently shortens.
    gauges: CHAO_PHRAYA_GAUGES.map((g) => {
      const s = byExternal.get(g.externalId);
      const value = num(s?.value ?? null);
      const bank = num(s?.bankLevelM ?? null);
      const { trend, deltaM } = trendOf(
        value,
        num(s?.earlierValue ?? null),
        s?.kind ?? "canal_level",
      );
      return {
        ...g,
        nameTh: s?.nameTh ?? null,
        nameEn: s?.nameEn ?? null,
        valueM: value,
        bankLevelM: bank,
        freeboardM:
          value !== null && bank !== null
            ? Math.round((bank - value) * 100) / 100
            : null,
        status:
          (s?.status as RiverResponse["gauges"][number]["status"]) ?? "unknown",
        dischargeM3s: num(s?.dischargeM3s ?? null),
        trend,
        deltaM,
        observedAt: s?.observedAt?.toISOString() ?? null,
      };
    }),
    dams: CHAO_PHRAYA_DAMS.map((d) => {
      const row = damById.get(d.id);
      return {
        ...d,
        nameTh: row?.nameTh ?? null,
        nameEn: row?.nameEn ?? null,
        storagePct: num(row?.storagePct ?? null),
        storageMcm: num(row?.storageMcm ?? null),
        maxStorageMcm: num(row?.maxStorageMcm ?? null),
        inflowMcm: num(row?.inflowMcm ?? null),
        releasedMcm: num(row?.releasedMcm ?? null),
        spilledMcm: num(row?.spilledMcm ?? null),
        observedOn: row?.observedOn ?? null,
      };
    }),
    meta: { generatedAt: new Date().toISOString(), degraded },
  };

  return NextResponse.json(body, {
    headers: {
      "cache-control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
