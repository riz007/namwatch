/**
 * Water depth bands. SPEC §6.1 (the band table) and §10 (colour non-negotiables).
 *
 * Hard rule 4: depth bands, labels and colours come ONLY from this file and the
 * `depth-*` tokens it generates. Do not invent new severity levels or colours.
 *
 * Hard rule 22 / SPEC §8.1: severity is never conveyed by colour alone. Every band
 * carries a colour, a pictogram and a text label, and the UI must render all three.
 *
 * The ramp is a sequential scale with strictly decreasing lightness, verified under
 * simulated protanopia, deuteranopia and tritanopia by `pnpm check:cvd` (SPEC §10.1).
 * Changing any hex here without re-running that check will fail CI.
 *
 * Labels live in `src/i18n/messages/{th,en}.json` under the keys below (Hard rule 15);
 * this file owns the band structure and the key names so nothing else invents a label.
 */

export const DEPTH_BANDS_COUNT = 6;

export type DepthBandValue = 0 | 1 | 2 | 3 | 4 | 5;

/** SPEC §6.1: "passable by" chips. */
export type Vehicle = 'motorbike' | 'car' | 'pickup' | 'none';

export type DepthBand = {
  readonly band: DepthBandValue;
  /** Tailwind/CSS token name. Maps to `--color-depth-N` in the theme. */
  readonly token: `depth-${DepthBandValue}`;
  /** i18n key for the short label, e.g. "ระดับเข่า" / "Knee-deep". */
  readonly labelKey: `depth.${DepthBandValue}.label`;
  /** i18n key for the passability sentence, e.g. "รถเล็กไม่ควรผ่าน". */
  readonly passabilityKey: `depth.${DepthBandValue}.passability`;
  /** Pictogram id rendered alongside the colour (never colour alone). */
  readonly pictogram: string;
  /** Approximate depth in cm: [min, max]. `null` max means open-ended. */
  readonly approxCm: readonly [number, number | null];
  /** Vehicles that can pass. `none` means not passable. */
  readonly passableBy: readonly Vehicle[];
  /** Background colour per theme. Validated by `pnpm check:cvd`. */
  readonly color: { readonly light: string; readonly dark: string };
  /** Foreground colour to place on top of `color`. Must meet WCAG AA (4.5:1). */
  readonly on: { readonly light: string; readonly dark: string };
  /**
   * Outline for the swatch. A pale fill cannot reach 3:1 against the page on its
   * own, so the border carries WCAG 2.2 SC 1.4.11 non-text contrast instead.
   * Always render it — the swatch is a graphical object conveying information.
   */
  readonly border: { readonly light: string; readonly dark: string };
};

export const DEPTH_BANDS: readonly DepthBand[] = [
  {
    band: 0,
    token: 'depth-0',
    labelKey: 'depth.0.label',
    passabilityKey: 'depth.0.passability',
    pictogram: 'dry',
    approxCm: [0, 0],
    passableBy: ['motorbike', 'car', 'pickup'],
    color: { light: '#356C6D', dark: '#5FBCBE' },
    on: { light: '#FFFFFF', dark: '#1A1206' },
    border: { light: '#356C6D', dark: '#5FBCBE' },
  },
  {
    band: 1,
    token: 'depth-1',
    labelKey: 'depth.1.label',
    passabilityKey: 'depth.1.passability',
    pictogram: 'ankle',
    approxCm: [0, 10],
    passableBy: ['motorbike', 'car', 'pickup'],
    color: { light: '#FCE3A6', dark: '#FAF0DA' },
    on: { light: '#1A1206', dark: '#1A1206' },
    border: { light: '#A69158', dark: '#FAF0DA' },
  },
  {
    band: 2,
    token: 'depth-2',
    labelKey: 'depth.2.label',
    passabilityKey: 'depth.2.passability',
    pictogram: 'shin',
    approxCm: [10, 30],
    passableBy: ['car', 'pickup'],
    color: { light: '#DEAE34', dark: '#F0C48E' },
    on: { light: '#1A1206', dark: '#1A1206' },
    border: { light: '#BA8E08', dark: '#F0C48E' },
  },
  {
    band: 3,
    token: 'depth-3',
    labelKey: 'depth.3.label',
    passabilityKey: 'depth.3.passability',
    pictogram: 'knee',
    approxCm: [30, 50],
    passableBy: ['pickup'],
    color: { light: '#B47B24', dark: '#E79351' },
    on: { light: '#1A1206', dark: '#1A1206' },
    border: { light: '#B47B24', dark: '#E79351' },
  },
  {
    band: 4,
    token: 'depth-4',
    labelKey: 'depth.4.label',
    passabilityKey: 'depth.4.passability',
    pictogram: 'waist',
    approxCm: [50, 100],
    passableBy: ['none'],
    color: { light: '#8E4714', dark: '#C86B3C' },
    on: { light: '#FFFFFF', dark: '#1A1206' },
    border: { light: '#8E4714', dark: '#C86B3C' },
  },
  {
    band: 5,
    token: 'depth-5',
    labelKey: 'depth.5.label',
    passabilityKey: 'depth.5.passability',
    pictogram: 'chest',
    approxCm: [100, null],
    passableBy: ['none'],
    color: { light: '#66110E', dark: '#A2482A' },
    on: { light: '#FFFFFF', dark: '#FFFFFF' },
    border: { light: '#66110E', dark: '#A2482A' },
  },
] as const;

export function depthBand(band: number): DepthBand {
  const found = DEPTH_BANDS[band];
  if (!found) throw new Error(`Unknown depth band: ${band}`);
  return found;
}

export function isDepthBand(value: unknown): value is DepthBandValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5;
}
