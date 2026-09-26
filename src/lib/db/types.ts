/**
 * PostGIS column helpers for Drizzle.
 *
 * Drizzle has no built-in PostGIS types, so geometry/geography columns are
 * declared with `customType`. Values are exchanged as GeoJSON via ST_AsGeoJSON /
 * ST_GeomFromGeoJSON in the query layer — never as raw WKB.
 */
import { customType } from 'drizzle-orm/pg-core';

export type Point = { readonly lon: number; readonly lat: number };

/** `geography(Point, 4326)` — metre-accurate distance maths, used for everything. */
export const geographyPoint = customType<{ data: Point; driverData: string }>({
  dataType: () => 'geography(Point,4326)',
});

/** `geometry(MultiPolygon, 4326)` — region boundaries. */
export const geometryMultiPolygon = customType<{ data: unknown; driverData: string }>({
  dataType: () => 'geometry(MultiPolygon, 4326)',
});
