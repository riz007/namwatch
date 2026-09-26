/**
 * Resolving a datum to a region. SPEC §11.
 *
 * District boundary geometry is not shipped yet (SPEC §18 open question 3: the
 * licence is unsettled), so resolution is by the Thai district name that
 * upstream feeds already carry. Point-in-polygon lookup replaces this once we
 * have boundaries we are allowed to use.
 */
import { BANGKOK_BBOX } from "@/config/app.config.ts";
import { regionByThaiDistrict, type Region } from "@/config/regions.ts";
import type { LonLat } from "../sources/types.ts";
import { contains } from "./bbox.ts";

export function resolveRegionId(
  districtTh: string | null | undefined,
): string | null {
  return regionByThaiDistrict(districtTh)?.id ?? null;
}

export const resolveRegion = (
  districtTh: string | null | undefined,
): Region | undefined => regionByThaiDistrict(districtTh);

/** Whether a point falls inside the served area. */
export const isInBangkok = (point: LonLat): boolean =>
  contains(BANGKOK_BBOX, point.lon, point.lat);
