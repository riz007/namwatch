/**
 * Rainfall intensity bands for a 24-hour accumulation.
 *
 * Thresholds follow the Thai Meteorological Department's own classification, so
 * the app agrees with the forecasts people are already reading:
 *
 *   ฝนเล็กน้อย   light            0.1 – 10.0 mm
 *   ฝนปานกลาง    moderate        10.1 – 35.0 mm
 *   ฝนหนัก       heavy           35.1 – 90.0 mm
 *   ฝนหนักมาก    very heavy      > 90.0 mm
 *
 * Rain is a separate scale from water depth and must never borrow the depth
 * tokens: 40 mm of rain and 40 cm of standing water are different claims, and
 * sharing a colour would assert they are the same.
 */

export const RAIN_BANDS = [
  "none",
  "light",
  "moderate",
  "heavy",
  "extreme",
] as const;
export type RainBand = (typeof RAIN_BANDS)[number];

export type RainBandDef = {
  readonly band: RainBand;
  readonly token: `rain-${RainBand}`;
  readonly labelKey: `rain.${RainBand}`;
  /** Lower bound in millimetres over 24 h, inclusive. */
  readonly minMm: number;
};

export const RAIN_BAND_DEFS: readonly RainBandDef[] = [
  { band: "none", token: "rain-none", labelKey: "rain.none", minMm: 0 },
  { band: "light", token: "rain-light", labelKey: "rain.light", minMm: 0.1 },
  {
    band: "moderate",
    token: "rain-moderate",
    labelKey: "rain.moderate",
    minMm: 10.1,
  },
  { band: "heavy", token: "rain-heavy", labelKey: "rain.heavy", minMm: 35.1 },
  {
    band: "extreme",
    token: "rain-extreme",
    labelKey: "rain.extreme",
    minMm: 90.1,
  },
] as const;

export function rainBandFor(mm: number | null | undefined): RainBand | null {
  if (mm === null || mm === undefined || !Number.isFinite(mm)) return null;
  let match: RainBand = "none";
  for (const def of RAIN_BAND_DEFS) {
    if (mm >= def.minMm) match = def.band;
  }
  return match;
}

export const rainBandDef = (band: RainBand): RainBandDef =>
  RAIN_BAND_DEFS.find((d) => d.band === band) ?? RAIN_BAND_DEFS[0]!;
