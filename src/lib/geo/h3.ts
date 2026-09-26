/**
 * H3 snapping for location privacy. SPEC §6.3.
 *
 * Public coordinates for `home` and `help` reports are snapped to the centre of
 * their H3 resolution-9 cell (~170 m across) so a home is never pinpointed.
 * `road` and `canal` keep exact coordinates — a blurred road closure is useless.
 *
 * The exact point is still stored server-side (`reports.geom_exact`) and must
 * never be returned by a public endpoint (Hard rule 10).
 */
import { H3_PUBLIC_RESOLUTION } from "@/config/app.config.ts";
import { cellToLatLng, latLngToCell } from "h3-js";
import type { ReportKind } from "../reports/decay.ts";
import type { LonLat } from "../sources/types.ts";

/** Kinds whose public location is blurred. SPEC §6.3. */
const BLURRED_KINDS: ReadonlySet<ReportKind> = new Set<ReportKind>([
  "home",
  "help",
]);

export const shouldBlur = (kind: ReportKind): boolean =>
  BLURRED_KINDS.has(kind);

export const h3IndexFor = (
  point: LonLat,
  resolution = H3_PUBLIC_RESOLUTION,
): string => latLngToCell(point.lat, point.lon, resolution);

/** The centre of the cell containing `point`. */
export function snapToCellCentre(
  point: LonLat,
  resolution = H3_PUBLIC_RESOLUTION,
): LonLat {
  const [lat, lon] = cellToLatLng(
    latLngToCell(point.lat, point.lon, resolution),
  );
  return { lon, lat };
}

/**
 * Both representations of a report's position: what we store privately and what
 * we are allowed to publish.
 */
export function publicLocation(
  point: LonLat,
  kind: ReportKind,
): { exact: LonLat; publicPoint: LonLat; h3R9: string } {
  return {
    exact: point,
    publicPoint: shouldBlur(kind) ? snapToCellCentre(point) : point,
    h3R9: h3IndexFor(point),
  };
}
