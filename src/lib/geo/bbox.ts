/**
 * Bounding-box parsing and clamping.
 *
 * No unbounded selects. Every map query is bbox-bounded, and the
 * span is clamped here so a client cannot ask for the whole planet.
 */
import { BANGKOK_BBOX, MAX_BBOX_SPAN_DEG } from "@/config/app.config.ts";

/** [west, south, east, north] in WGS84 degrees. */
export type BBox = readonly [number, number, number, number];

export class InvalidBBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBBoxError";
  }
}

/**
 * Parses a `?bbox=w,s,e,n` query value. Throws `InvalidBBoxError` on anything
 * malformed so the route can answer 400 rather than guess.
 */
export function parseBBox(raw: string | null | undefined): BBox {
  if (!raw) return BANGKOK_BBOX;

  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new InvalidBBoxError(
      "bbox must be four comma-separated numbers: west,south,east,north",
    );
  }

  const [west, south, east, north] = parts as [number, number, number, number];
  if (west < -180 || east > 180 || south < -90 || north > 90) {
    throw new InvalidBBoxError("bbox is outside valid WGS84 bounds");
  }
  if (west >= east || south >= north) {
    throw new InvalidBBoxError("bbox must have west < east and south < north");
  }

  return clampSpan([west, south, east, north]);
}

/**
 * Shrinks an over-wide box around its centre rather than rejecting it, so a
 * zoomed-out client still gets useful data instead of an error.
 */
export function clampSpan(
  bbox: BBox,
  maxSpan: number = MAX_BBOX_SPAN_DEG,
): BBox {
  const [west, south, east, north] = bbox;
  const lonSpan = east - west;
  const latSpan = north - south;
  if (lonSpan <= maxSpan && latSpan <= maxSpan) return bbox;

  const cx = (west + east) / 2;
  const cy = (south + north) / 2;
  const halfLon = Math.min(lonSpan, maxSpan) / 2;
  const halfLat = Math.min(latSpan, maxSpan) / 2;
  return [
    Math.max(-180, cx - halfLon),
    Math.max(-90, cy - halfLat),
    Math.min(180, cx + halfLon),
    Math.min(90, cy + halfLat),
  ];
}

export const contains = (bbox: BBox, lon: number, lat: number): boolean =>
  lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
