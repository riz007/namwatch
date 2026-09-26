/**
 * Crowd trust signals. SPEC §6.2.
 */
import {
  CORROBORATION_RADIUS_M,
  FLAGS_TO_AUTOHIDE,
} from "@/config/app.config.ts";
import type { LonLat } from "../sources/types.ts";

/**
 * How many independent "water receded" votes retire a report.
 *
 * SPEC §6.2 says a vote can end a report's life but does not give a number.
 * One is too few: a single device could clear a genuine report during an
 * emergency, which is the most damaging failure this feature has. Two
 * independent devices, and only while they outnumber the "still flooded"
 * votes, keeps it responsive without handing one actor a delete button.
 */
export const RECEDED_VOTES_TO_EXPIRE = 2;

export type VoteCounts = {
  readonly still: number;
  readonly receded: number;
  readonly flags: number;
};

/** SPEC §6.2: three distinct device flags auto-hide a report pending review. */
export const shouldAutoHide = (counts: VoteCounts): boolean =>
  counts.flags >= FLAGS_TO_AUTOHIDE;

/** SPEC §6.2: the crowd can retract a report by agreeing the water has gone. */
export const shouldExpireFromVotes = (counts: VoteCounts): boolean =>
  counts.receded >= RECEDED_VOTES_TO_EXPIRE && counts.receded > counts.still;

/** Great-circle distance in metres. */
export function distanceMeters(a: LonLat, b: LonLat): number {
  const R = 6_371_000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type NearbyStation = {
  readonly point: LonLat;
  /** Normalised reading status from the adapter. */
  readonly status: "normal" | "watch" | "warning" | "critical" | "unknown";
};

/**
 * SPEC §6.2 corroboration badge: "near an official sensor showing flooding".
 * Only `warning` and `critical` count — `watch` means rising, not flooding.
 */
export function isCorroborated(
  report: LonLat,
  stations: readonly NearbyStation[],
  radiusM: number = CORROBORATION_RADIUS_M,
): boolean {
  return stations.some(
    (s) =>
      (s.status === "critical" || s.status === "warning") &&
      distanceMeters(report, s.point) <= radiusM,
  );
}
