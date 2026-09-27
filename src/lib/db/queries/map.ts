import "server-only";

import { MAX_MAP_FEATURES } from "@/config/app.config.ts";
import type { BBox } from "@/lib/geo/bbox.ts";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../index.ts";
import {
  externalReports,
  reports,
  stationReadings,
  stations,
} from "../schema.ts";

/**
 * Read queries for the map. SQL lives only here.
 *
 * Location privacy is structural: these selects never name `geom_exact`, which
 * is read only by server-side corroboration logic and never by anything that
 * feeds a response body. A test asserts it.
 *
 * Every query is bbox-bounded and limited.
 */

/** PostGIS: a bbox as a geography, for `ST_Intersects`. */
/**
 * A reading's severity is computed when it is ingested and then frozen in the
 * row. If ingest stalls, that row keeps asserting "critical" forever — the map
 * would show an emergency from data hours out of date. Severity is therefore
 * re-checked against the clock on every read, not just at write time.
 */
// Kept in sync by hand with the literal in the queries below: drizzle binds
// interpolations as parameters, and an interval cannot be parameterised inside
// quotes.
export const READ_STALE_AFTER_HOURS = 3;

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
      // Geom_public only — never geom_exact.
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
        eq(reports.status, "active"),
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
type RawStationRow = Omit<MapStation, "observedAt"> & {
  observedAt: string | Date | null;
};

/**
 * Stations with their most recent reading.
 *
 * Uses a LATERAL join rather than fetching stations and then their readings,
 * which would be an N+1 against the free tier.
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
      case
        when r.observed_at < now() - interval '3 hours' then 'unknown'
        else r.status
      end                      as status,
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
        // A complaint the agency has closed, or judged unrelated, is not
        // current flooding. Showing it as one overstates the situation.
        sql`coalesce(${externalReports.meta}->>'stateType', '') not in ('finish','irrelevant')`,
        sql`ST_Intersects(${externalReports.geom}, ${bboxGeog(bbox)})`,
      ),
    )
    .orderBy(sql`${externalReports.observedAt} desc`)
    .limit(limit);
}

/**
 * Stations near a point that are currently showing flooding, for the
 * corroboration badge. Server-side only.
 */
export async function floodingStationsNear(
  lon: number,
  lat: number,
  radiusM: number,
): Promise<readonly { lon: number; lat: number; status: string }[]> {
  const rows = await db().execute<{
    lon: number;
    lat: number;
    status: string;
  }>(sql`
    select ST_X(s.geom::geometry) as lon, ST_Y(s.geom::geometry) as lat, r.status
    from ${stations} s
    join lateral (
      select status from ${stationReadings}
      where station_id = s.id order by observed_at desc limit 1
    ) r on true
    where r.status in ('warning','critical')
      and r.observed_at >= now() - interval '3 hours'
      and ST_DWithin(s.geom, ST_MakePoint(${lon}, ${lat})::geography, ${radiusM})
    limit 20
  `);
  return rows as unknown as readonly {
    lon: number;
    lat: number;
    status: string;
  }[];
}
