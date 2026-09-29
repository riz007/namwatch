import { toNumber } from "../thaiwater/normalize.ts";
import type { IngestPayload, NormalizedDam } from "../types.ts";
import { damPayloadSchema } from "./schema.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pure. One row per dam; a row without a usable position or date is dropped
 * rather than guessed, because a dam in the wrong place is worse than none.
 */
export function normalizeDams(raw: unknown): IngestPayload {
  const parsed = damPayloadSchema.parse(raw);
  const dams: NormalizedDam[] = [];

  for (const row of parsed.dam.data.data) {
    const lon = toNumber(row.dam.dam_long);
    const lat = toNumber(row.dam.dam_lat);
    if (lon === null || lat === null || (lon === 0 && lat === 0)) continue;
    if (!DATE.test(row.dam_date)) continue;

    dams.push({
      source: "thaiwater-dam",
      externalId: String(row.dam.id),
      nameTh: row.dam.dam_name.th.trim(),
      nameEn: row.dam.dam_name.en?.trim() || null,
      point: { lon, lat },
      maxStorageMcm: toNumber(row.dam.max_storage),
      storageMcm: toNumber(row.dam_storage),
      storagePct: toNumber(row.dam_storage_percent),
      inflowMcm: toNumber(row.dam_inflow),
      releasedMcm: toNumber(row.dam_released),
      spilledMcm: toNumber(row.dam_spilled),
      observedOn: row.dam_date,
    });
  }

  return { stations: [], readings: [], externalReports: [], dams };
}
