import "server-only";

import { resolveRegionId } from "@/lib/geo/region.ts";
import type { IngestPayload } from "@/lib/sources/types.ts";
import { lt, sql } from "drizzle-orm";
import { db } from "../index.ts";
import { dams, externalReports, stationReadings, stations } from "../schema.ts";

/**
 * Persisting a normalised adapter payload. SQL lives only here.
 *
 * Writes are upserts keyed on (source, external_id), so re-running ingest is
 * idempotent — which matters because the GitHub Actions cron can overlap with
 * the lazy refresh path.
 *
 * Everything is chunked: the free tier will not thank us for a 4 MB single
 * statement, and ThaiWater alone returns 800+ stations.
 */

const CHUNK = 200;

const chunk = <T>(items: readonly T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
};

export type IngestCounts = {
  stations: number;
  readings: number;
  externalReports: number;
  dams: number;
};

export async function persistPayload(
  payload: IngestPayload,
): Promise<IngestCounts> {
  const counts: IngestCounts = {
    stations: 0,
    readings: 0,
    externalReports: 0,
    dams: 0,
  };

  for (const batch of chunk(payload.stations)) {
    await db()
      .insert(stations)
      .values(
        batch.map((s) => ({
          source: s.source,
          externalId: s.externalId,
          kind: s.kind,
          nameTh: s.nameTh,
          nameEn: s.nameEn,
          geom: sql`ST_MakePoint(${s.point.lon}, ${s.point.lat})::geography` as never,
          regionId: resolveRegionId(s.districtTh),
          bankLevelM: s.bankLevelM?.toString() ?? null,
          groundLevelM: s.groundLevelM?.toString() ?? null,
          meta: s.meta,
        })),
      )
      .onConflictDoUpdate({
        target: [stations.source, stations.externalId],
        set: {
          kind: sql`excluded.kind`,
          nameTh: sql`excluded.name_th`,
          nameEn: sql`excluded.name_en`,
          geom: sql`excluded.geom`,
          regionId: sql`excluded.region_id`,
          bankLevelM: sql`excluded.bank_level_m`,
          groundLevelM: sql`excluded.ground_level_m`,
          meta: sql`excluded.meta`,
        },
      });
    counts.stations += batch.length;
  }

  if (payload.readings.length > 0) {
    // Readings reference stations by (source, external_id); resolve to ids in one
    // statement rather than a lookup per reading.
    for (const batch of chunk(payload.readings)) {
      // Every parameter is cast explicitly: Postgres cannot infer column types
      // for a bare VALUES list used as a join source, and an untyped timestamptz
      // fails at bind time.
      const values = sql.join(
        batch.map(
          (r) =>
            sql`(${r.source}::text, ${r.externalId}::text, ${r.observedAt.toISOString()}::timestamptz, ${r.value.toString()}::numeric, ${r.status}::text, ${r.dischargeM3s == null ? null : r.dischargeM3s.toString()}::numeric)`,
        ),
        sql`, `,
      );
      await db().execute(sql`
        insert into ${stationReadings} (station_id, observed_at, value, status, discharge_m3s)
        select s.id, v.observed_at, v.value, v.status, v.discharge_m3s
        from (values ${values}) as v(source, external_id, observed_at, value, status, discharge_m3s)
        join ${stations} s on s.source = v.source and s.external_id = v.external_id
        on conflict (station_id, observed_at) do update
          set value = excluded.value, status = excluded.status,
              discharge_m3s = excluded.discharge_m3s
      `);
      counts.readings += batch.length;
    }
  }

  for (const batch of chunk(payload.externalReports)) {
    await db()
      .insert(externalReports)
      .values(
        batch.map((e) => ({
          source: e.source,
          externalId: e.externalId,
          provenance: e.provenance,
          kind: e.kind,
          geom: sql`ST_MakePoint(${e.point.lon}, ${e.point.lat})::geography` as never,
          regionId: resolveRegionId(e.districtTh),
          state: e.state,
          description: e.description,
          url: e.url,
          photoUrl: e.photoUrl,
          observedAt: e.observedAt,
          meta: e.meta,
        })),
      )
      .onConflictDoUpdate({
        target: [externalReports.source, externalReports.externalId],
        set: {
          state: sql`excluded.state`,
          description: sql`excluded.description`,
          photoUrl: sql`excluded.photo_url`,
          observedAt: sql`excluded.observed_at`,
          regionId: sql`excluded.region_id`,
          meta: sql`excluded.meta`,
          ingestedAt: sql`now()`,
        },
      });
    counts.externalReports += batch.length;
  }

  // Latest state only: one row per dam, overwritten each ingest. `numeric`
  // columns take strings so no float is ever rounded on the way in.
  const num = (v: number | null): string | null =>
    v === null ? null : v.toString();
  for (const batch of chunk(payload.dams ?? [])) {
    await db()
      .insert(dams)
      .values(
        batch.map((d) => ({
          id: `${d.source}:${d.externalId}`,
          source: d.source,
          nameTh: d.nameTh,
          nameEn: d.nameEn,
          lon: d.point.lon,
          lat: d.point.lat,
          maxStorageMcm: num(d.maxStorageMcm),
          storageMcm: num(d.storageMcm),
          storagePct: num(d.storagePct),
          inflowMcm: num(d.inflowMcm),
          releasedMcm: num(d.releasedMcm),
          spilledMcm: num(d.spilledMcm),
          observedOn: d.observedOn,
        })),
      )
      .onConflictDoUpdate({
        target: dams.id,
        set: {
          nameTh: sql`excluded.name_th`,
          nameEn: sql`excluded.name_en`,
          lon: sql`excluded.lon`,
          lat: sql`excluded.lat`,
          maxStorageMcm: sql`excluded.max_storage_mcm`,
          storageMcm: sql`excluded.storage_mcm`,
          storagePct: sql`excluded.storage_pct`,
          inflowMcm: sql`excluded.inflow_mcm`,
          releasedMcm: sql`excluded.released_mcm`,
          spilledMcm: sql`excluded.spilled_mcm`,
          observedOn: sql`excluded.observed_on`,
          updatedAt: sql`now()`,
        },
      });
    counts.dams += batch.length;
  }

  return counts;
}

/**
 * Retention: raw readings are kept 14 days, then rolled up to hourly.
 * Called by /api/internal/maintain.
 */
export async function pruneOldReadings(olderThan: Date): Promise<number> {
  // Typed operator rather than a raw `sql` template: interpolating a Date into
  // a template gives the driver a Date object with no column type to map it
  // through, and postgres.js cannot serialise that. It fails every time.
  const rows = await db()
    .delete(stationReadings)
    .where(lt(stationReadings.observedAt, olderThan))
    .returning({ stationId: stationReadings.stationId });
  return rows.length;
}

export async function seedRegions(
  regions: readonly {
    id: string;
    level: string;
    parentId: string | null;
    nameTh: string;
    nameEn: string;
    slug: string;
    enabled: boolean;
  }[],
): Promise<number> {
  const { regions: table } = await import("../schema.ts");
  for (const batch of chunk(regions)) {
    await db()
      .insert(table)
      .values([...batch])
      .onConflictDoUpdate({
        target: table.id,
        set: {
          nameTh: sql`excluded.name_th`,
          nameEn: sql`excluded.name_en`,
          slug: sql`excluded.slug`,
          enabled: sql`excluded.enabled`,
        },
      });
  }
  return regions.length;
}
