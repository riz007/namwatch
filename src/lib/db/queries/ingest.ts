import "server-only";

import { resolveRegionId } from "@/lib/geo/region.ts";
import type { IngestPayload } from "@/lib/sources/types.ts";
import { sql } from "drizzle-orm";
import { db } from "../index.ts";
import { externalReports, stationReadings, stations } from "../schema.ts";

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
};

export async function persistPayload(
  payload: IngestPayload,
): Promise<IngestCounts> {
  const counts: IngestCounts = { stations: 0, readings: 0, externalReports: 0 };

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
            sql`(${r.source}::text, ${r.externalId}::text, ${r.observedAt.toISOString()}::timestamptz, ${r.value.toString()}::numeric, ${r.status}::text)`,
        ),
        sql`, `,
      );
      await db().execute(sql`
        insert into ${stationReadings} (station_id, observed_at, value, status)
        select s.id, v.observed_at, v.value, v.status
        from (values ${values}) as v(source, external_id, observed_at, value, status)
        join ${stations} s on s.source = v.source and s.external_id = v.external_id
        on conflict (station_id, observed_at) do update
          set value = excluded.value, status = excluded.status
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

  return counts;
}

/**
 * Retention: raw readings are kept 14 days, then rolled up to hourly.
 * Called by /api/internal/maintain.
 */
export async function pruneOldReadings(olderThan: Date): Promise<number> {
  const rows = await db().execute<{ count: number }>(sql`
    with deleted as (
      delete from ${stationReadings} where observed_at < ${olderThan} returning 1
    )
    select count(*)::int as count from deleted
  `);
  return (rows as unknown as { count: number }[])[0]?.count ?? 0;
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
