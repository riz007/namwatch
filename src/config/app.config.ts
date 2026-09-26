/**
 * Global app configuration. (working name), §7 (architecture), §8.4 (map).
 * Rename the app here and in the i18n `app.name` keys only (SPEC header note).
 */

/**
 * Public origin. Used for canonical URLs, share cards and the sitemap.
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://namwatch.vercel.app');

export const APP = {
  /** Working name. See SPEC.md header before renaming. */
  nameKey: 'app.name',
  repoUrl: 'https://github.com/namwatch/namwatch',
  /** Sent upstream by every scraper/fetcher so agencies can identify us. */
  userAgent: 'NamWatch/0.1 (+https://github.com/namwatch/namwatch)',
  timeZone: 'Asia/Bangkok',
} as const;

/** default view is the Bangkok bbox. [west, south, east, north] */
export const BANGKOK_BBOX: readonly [number, number, number, number] = [
  100.327, 13.494, 100.938, 13.956,
];

/** Hard clamp for any bbox query, so a bad client can't ask for the planet. */
export const MAX_BBOX_SPAN_DEG = 3;

/** Maximum features any single map query may return. */
export const MAX_MAP_FEATURES = 2000;

/**
 * SWR poll intervals in ms. and never below 30 s.
 */
export const POLL_MS = {
  map: 60_000,
  district: 120_000,
  health: 300_000,
} as const;

/** Minimum permitted poll interval. Enforced by a unit test. */
export const MIN_POLL_MS = 30_000;

/**
 * Map time-window filter chips.
 */
export const TIME_WINDOWS_H = [1, 3, 12] as const;
export type TimeWindowH = (typeof TIME_WINDOWS_H)[number];

/**
 * Report lifetime rules..
 * Opacity is 100% until `fullOpacityH`, fades to `fadedOpacity` by `fadedAtH`,
 * and the report is hidden at `hiddenAtH` unless reconfirmed.
 */
export const DECAY = {
  fullOpacityH: 1,
  fadedAtH: 6,
  fadedOpacity: 0.4,
  hiddenAtH: 12,
  /** `help` reports stay visible longer. */
  helpHiddenAtH: 24,
} as const;

/** anti-abuse: 5 reports per 10 min per device hash and per IP hash. */
export const RATE_LIMIT = {
  maxReports: 5,
  windowMs: 10 * 60_000,
} as const;

/** three distinct device flags auto-hide a report pending review. */
export const FLAGS_TO_AUTOHIDE = 3;

/** corroboration radius against an official station, in metres. */
export const CORROBORATION_RADIUS_M = 500;

/** public coordinates for `home`/`help` are snapped to H3 resolution 9. */
export const H3_PUBLIC_RESOLUTION = 9;

/** note length limit. Mirrored by the DB check constraint. */
export const NOTE_MAX_LENGTH = 280;

/** a source is "delayed" once it is older than 3× its cadence. */
export const STALE_CADENCE_MULTIPLIER = 3;
