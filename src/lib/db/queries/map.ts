import 'server-only';

import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../index.ts';
import { externalReports, reports, stationReadings, stations } from '../schema.ts';
import { MAX_MAP_FEATURES } from '@/config/app.config.ts';
import type { BBox } from '@/lib/geo/bbox.ts';

/**
 * Read queries for the map. Hard rule 7: SQL lives only here.
 *
 * Hard rule 10 is enforced structurally: these selects never name `geom_exact`.
 * `reports.geom_exact` is only ever read by server-side corroboration logic,
 * never by anything that feeds a response body. `reports.test.ts` asserts it.
 *
 * Hard rule 11: every query is bbox-bounded and limited.
 */

/** PostGIS: a bbox as a geography, for `ST_Intersects`. */
const bboxGeog = (b: BBox) =>
  sql`ST_MakeEnvelope(${b[0]}, ${b[1]}, ${b[2]}, ${b[3]}, 4326)::geography`;

export type MapReport = {
  id: string;
  kind: string;
  depthBand: number;
  note: string | null;
  lon: number;
  lat: number;
  createdAt: Date;
  expiresAt: Date;
  stillCount: number;
  recededCount: number;
  regionId: string | null;
};

export async function reportsInBBox(
  bbox: BBox,
  since: Date,
  now: Date = new Date(),
  limit: number = MAX_MAP_FEATURES,
): Promise<readonly MapReport[]> {
  return db()
    .select({
      id: reports.id,
      kind: reports.kind,
      depthBand: reports.depthBand,
      note: reports.note,
      // geom_public only — never geom_exact (Hard rule 10).
      lon: sql<number>`ST_X(${reports.geomPublic}::geometry)`,
      lat: sql<number>`ST_Y(${reports.geomPublic}::geometry)`,
      createdAt: reports.createdAt,
      expiresAt: reports.expiresAt,
      stillCount: reports.stillCount,
      recededCount: reports.recededCount,
      regionId: reports.regionId,
    })
    .from(reports)
    .where(
      and(
        eq(reports.status, 'active'),
        gte(reports.expiresAt, now),
        gte(reports.createdAt, since),
        sql`ST_Intersects(${reports.geomPublic}, ${bboxGeog(bbox)})`,
      ),
    )
    .orderBy(sql`${reports.createdAt} desc`)
    .limit(limit);
}

export type MapStation = {
  id: string;
  source: string;
  externalId: string;
  kind: string;
  nameTh: string | null;
  nameEn: string | null;
  lon: number;
  lat: number;
  bankLevelM: string | null;
  value: string | null;
  status: string | null;
  observedAt: Date | null;
};

/**
 * Raw `execute()` bypasses Drizzle's type mapping, so timestamps arrive as
 * strings and numerics as strings. Coerce once here rather than letting the
 * declared type lie to every caller.
 */
type RawStationRow = Omit<MapStation, 'observedAt'> & { observedAt: string | Date | null };

/**
 * Stations with their most recent reading.
 *
 * Uses a LATERAL join rather than fetching stations and then their readings,
 * which would be an N+1 against the free tier (Hard rule 11).
 */
export async function stationsInBBox(
  bbox: BBox,
  limit: number = MAX_MAP_FEATURES,
): Promise<readonly MapStation[]> {
  const rows = await db().execute<RawStationRow>(sql`
    select
      s.id,
      s.source,
      s.external_id            as "externalId",
      s.kind,
      s.name_th                as "nameTh",
      s.name_en                as "nameEn",
      ST_X(s.geom::geometry)   as lon,
      ST_Y(s.geom::geometry)   as lat,
      s.bank_level_m           as "bankLevelM",
      r.value,
      r.status,
      r.observed_at            as "observedAt"
    from ${stations} s
    left join lateral (
      select value, status, observed_at
      from ${stationReadings}
      where station_id = s.id
      order by observed_at desc
      limit 1
    ) r on true
    where ST_Intersects(s.geom, ${bboxGeog(bbox)})
    order by r.observed_at desc nulls last
    limit ${limit}
  `);

  return (rows as unknown as readonly RawStationRow[]).map((r) => ({
    ...r,
    observedAt: r.observedAt === null ? null : new Date(r.observedAt),
  }));
}

export type MapExternalReport = {
  id: string;
  source: string;
  externalId: string;
  provenance: string;
  kind: string;
  lon: number;
  lat: number;
  state: string | null;
  description: string | null;
  url: string | null;
  observedAt: Date;
  regionId: string | null;
};

export async function externalReportsInBBox(
  bbox: BBox,
  since: Date,
  limit: number = MAX_MAP_FEATURES,
): Promise<readonly MapExternalReport[]> {
  return db()
    .select({
      id: externalReports.id,
      source: externalReports.source,
      externalId: externalReports.externalId,
      provenance: externalReports.provenance,
      kind: externalReports.kind,
      lon: sql<number>`ST_X(${externalReports.geom}::geometry)`,
      lat: sql<number>`ST_Y(${externalReports.geom}::geometry)`,
      state: externalReports.state,
      description: externalReports.description,
      url: externalReports.url,
      observedAt: externalReports.observedAt,
      regionId: externalReports.regionId,
    })
    .from(externalReports)
    .where(
      and(
        gte(externalReports.observedAt, since),
        sql`ST_Intersects(${externalReports.geom}, ${bboxGeog(bbox)})`,
      ),
    )
    .orderBy(sql`${externalReports.observedAt} desc`)
    .limit(limit);
}

/**
 * Stations near a point that are currently showing flooding, for the
 * corroboration badge (SPEC §6.2). Server-side only.
 */
export async function floodingStationsNear(
  lon: number,
  lat: number,
  radiusM: number,
): Promise<readonly { lon: number; lat: number; status: string }[]> {
  const rows = await db().execute<{ lon: number; lat: number; status: string }>(sql`
    select ST_X(s.geom::geometry) as lon, ST_Y(s.geom::geometry) as lat, r.status
    from ${stations} s
    join lateral (
      select status from ${stationReadings}
      where station_id = s.id order by observed_at desc limit 1
    ) r on true
    where r.status in ('warning','critical')
      and ST_DWithin(s.geom, ST_MakePoint(${lon}, ${lat})::geography, ${radiusM})
    limit 20
  `);
  return rows as unknown as readonly { lon: number; lat: number; status: string }[];
}
