/**
 * Whether water is rising, falling or holding, from two of our own readings.
 *
 * Computed from the readings we already store every ten minutes, not from an
 * upstream time-series endpoint: no extra transfer, and no dependence on a
 * parameter format we have not been able to verify.
 *
 * The comparison point is the reading nearest two hours earlier. Shorter and a
 * gauge's own jitter reads as movement; much longer and a turn in the tide is
 * reported late. Below 3 cm in either direction it is "steady": gauges report
 * to the centimetre, so anything smaller is noise, not a claim worth making.
 */
export type Trend = "rising" | "falling" | "steady";

export const TREND_THRESHOLD_M = 0.03;

export function trendOf(
  current: number | null,
  earlier: number | null,
  kind: string,
): { trend: Trend | null; deltaM: number | null } {
  // Rain is an accumulation, not a level: "rising" would mean something else.
  if (kind === "rain" || current === null || earlier === null) {
    return { trend: null, deltaM: null };
  }
  const deltaM = Math.round((current - earlier) * 100) / 100;
  if (deltaM >= TREND_THRESHOLD_M) return { trend: "rising", deltaM };
  if (deltaM <= -TREND_THRESHOLD_M) return { trend: "falling", deltaM };
  return { trend: "steady", deltaM };
}
